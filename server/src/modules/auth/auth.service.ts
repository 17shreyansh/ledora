import type { RegisterInput, LoginInput } from '@ledora/shared';
import type { Types } from 'mongoose';
import type { Redis } from 'ioredis';
import type { Config } from '../../config/env.js';
import { AppError } from '../../common/errors/AppError.js';
import { generateToken, hashToken } from '../../common/utils/tokens.js';
import type { MailDispatcher } from '../../services/mail/dispatcher.js';
import type { AuditService } from '../audit/audit.service.js';
import { UserModel, type User } from '../users/user.model.js';
import { AuthTokenModel, type AuthTokenType } from './authToken.model.js';
import { burnPasswordCheck, hashPassword, verifyPassword } from './password.js';
import { SessionModel, type Session } from './session.model.js';

export interface ClientMeta {
  ip: string | null;
  userAgent: string | null;
}

const VERIFICATION_TTL_MS = 24 * 3_600_000;
const RESET_TTL_MS = 3_600_000;
const LOGIN_FAILURE_WINDOW_S = 15 * 60;
const LOGIN_FAILURE_LIMIT = 10;
const EMAIL_RESEND_COOLDOWN_S = 60;
const SESSION_TOUCH_INTERVAL_MS = 10 * 60_000;

function isDuplicateKey(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

export class AuthService {
  constructor(
    private readonly config: Config,
    private readonly redis: Redis,
    private readonly mail: MailDispatcher,
    private readonly audit: AuditService,
  ) {}

  // ── Sessions ────────────────────────────────────────────────────────────

  private sessionHash(raw: string) {
    return hashToken(this.config.AUTH_SECRET, raw, 'session');
  }

  /** CSRF synchronizer token derived from the session token; nothing extra to store. */
  csrfTokenFor(rawSessionToken: string): string {
    return hashToken(this.config.AUTH_SECRET, rawSessionToken, 'csrf');
  }

  async createSession(userId: Types.ObjectId, meta: ClientMeta): Promise<{ rawToken: string; session: Session }> {
    const rawToken = generateToken();
    const now = new Date();
    const session = await SessionModel.create({
      userId,
      tokenHash: this.sessionHash(rawToken),
      userAgent: meta.userAgent?.slice(0, 512) ?? null,
      ip: meta.ip,
      expiresAt: new Date(now.getTime() + this.config.SESSION_TTL_DAYS * 86_400_000),
      lastSeenAt: now,
    });
    return { rawToken, session: session.toObject() };
  }

  async resolveSession(rawToken: string): Promise<{ user: User; session: Session } | null> {
    if (rawToken.length < 20 || rawToken.length > 200) return null;
    const session = await SessionModel.findOne({ tokenHash: this.sessionHash(rawToken) }).lean<Session>();
    if (!session || session.expiresAt.getTime() <= Date.now()) return null;
    const user = await UserModel.findById(session.userId).lean<User>();
    if (!user || user.status !== 'active') return null;
    if (user.passwordChangedAt && user.passwordChangedAt > session.createdAt) return null;
    if (Date.now() - session.lastSeenAt.getTime() > SESSION_TOUCH_INTERVAL_MS) {
      await SessionModel.updateOne({ _id: session._id }, { $set: { lastSeenAt: new Date() } });
    }
    return { user, session };
  }

  async destroySession(sessionId: Types.ObjectId): Promise<void> {
    await SessionModel.deleteOne({ _id: sessionId });
  }

  // ── Registration & login ────────────────────────────────────────────────

  async register(input: RegisterInput, meta: ClientMeta) {
    const passwordHash = await hashPassword(input.password);
    let user: User;
    try {
      user = (await UserModel.create({ email: input.email, name: input.name, passwordHash })).toObject();
    } catch (err) {
      if (isDuplicateKey(err)) {
        throw AppError.conflict('An account with this email already exists', {
          email: 'An account with this email already exists. Sign in instead.',
        });
      }
      throw err;
    }
    await this.audit.record({ action: 'auth.registered', actorId: user._id, target: { type: 'user', id: user._id }, ip: meta.ip });
    await this.issueEmailVerification(user);
    const { rawToken } = await this.createSession(user._id, meta);
    return { user, rawToken };
  }

  private failureKey(email: string) {
    return `auth:login-failures:${hashToken(this.config.AUTH_SECRET, email, 'login-failures')}`;
  }

  async login(input: LoginInput, meta: ClientMeta) {
    const key = this.failureKey(input.email);
    const failures = Number((await this.redis.get(key)) ?? 0);
    if (this.config.RATE_LIMIT_ENABLED && failures >= LOGIN_FAILURE_LIMIT) {
      throw new AppError(429, 'RATE_LIMITED', 'Too many failed sign-in attempts. Try again in 15 minutes or reset your password.');
    }

    const user = await UserModel.findOne({ email: input.email }).select('+passwordHash').lean<User>();
    const ok = user ? await verifyPassword(user.passwordHash, input.password) : (await burnPasswordCheck(input.password), false);

    if (!user || !ok) {
      await this.redis.multi().incr(key).expire(key, LOGIN_FAILURE_WINDOW_S).exec();
      if (user) {
        await this.audit.record({ action: 'auth.login_failed', actorId: user._id, target: { type: 'user', id: user._id }, ip: meta.ip });
      }
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
    }
    if (user.status !== 'active') {
      throw AppError.forbidden('This account is disabled. Contact support.');
    }

    await this.redis.del(key);
    const { rawToken } = await this.createSession(user._id, meta);
    await this.audit.record({ action: 'auth.login', actorId: user._id, target: { type: 'user', id: user._id }, ip: meta.ip });
    return { user, rawToken };
  }

  // ── One-time tokens ─────────────────────────────────────────────────────

  private async issueToken(type: AuthTokenType, userId: Types.ObjectId, ttlMs: number): Promise<string> {
    // Only the newest token of a type is valid.
    await AuthTokenModel.deleteMany({ userId, type, usedAt: null });
    const raw = generateToken();
    await AuthTokenModel.create({
      type,
      userId,
      tokenHash: hashToken(this.config.AUTH_SECRET, raw, type),
      expiresAt: new Date(Date.now() + ttlMs),
    });
    return raw;
  }

  /** Atomically marks a token used. Returns the user id, or null if invalid/expired/used. */
  private async consumeToken(type: AuthTokenType, raw: string): Promise<Types.ObjectId | null> {
    const token = await AuthTokenModel.findOneAndUpdate(
      { tokenHash: hashToken(this.config.AUTH_SECRET, raw, type), type, usedAt: null, expiresAt: { $gt: new Date() } },
      { $set: { usedAt: new Date() } },
      { new: true },
    ).lean();
    return token?.userId ?? null;
  }

  /** True if the caller should wait before another email of this kind is sent. */
  private async throttled(kind: string, id: string): Promise<boolean> {
    if (!this.config.RATE_LIMIT_ENABLED) return false;
    const res = await this.redis.set(`auth:cooldown:${kind}:${id}`, '1', 'EX', EMAIL_RESEND_COOLDOWN_S, 'NX');
    return res !== 'OK';
  }

  async issueEmailVerification(user: Pick<User, '_id' | 'email' | 'name'>): Promise<void> {
    const raw = await this.issueToken('email_verification', user._id, VERIFICATION_TTL_MS);
    await this.mail.dispatch({
      to: user.email,
      template: 'verify_email',
      data: { name: user.name, link: `${this.config.APP_URL}/verify-email?token=${encodeURIComponent(raw)}` },
    });
  }

  async resendEmailVerification(user: User): Promise<void> {
    if (user.emailVerifiedAt) return;
    if (await this.throttled('verify', user._id.toHexString())) {
      throw new AppError(429, 'RATE_LIMITED', 'Please wait a minute before requesting another email');
    }
    await this.issueEmailVerification(user);
  }

  async verifyEmail(raw: string, meta: ClientMeta): Promise<void> {
    const userId = await this.consumeToken('email_verification', raw);
    if (!userId) throw new AppError(400, 'TOKEN_INVALID', 'This verification link is invalid or has expired');
    await UserModel.updateOne({ _id: userId, emailVerifiedAt: null }, { $set: { emailVerifiedAt: new Date() } });
    await this.audit.record({ action: 'auth.email_verified', actorId: userId, target: { type: 'user', id: userId }, ip: meta.ip });
  }

  /** Always succeeds from the caller's point of view, so it cannot be used to discover accounts. */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await UserModel.findOne({ email, status: 'active' }).lean<User>();
    if (!user) return;
    if (await this.throttled('reset', user._id.toHexString())) return;
    const raw = await this.issueToken('password_reset', user._id, RESET_TTL_MS);
    await this.mail.dispatch({
      to: user.email,
      template: 'password_reset',
      data: { name: user.name, link: `${this.config.APP_URL}/reset-password?token=${encodeURIComponent(raw)}` },
    });
  }

  async resetPassword(raw: string, newPassword: string, meta: ClientMeta): Promise<void> {
    const userId = await this.consumeToken('password_reset', raw);
    if (!userId) throw new AppError(400, 'TOKEN_INVALID', 'This reset link is invalid or has expired');
    const passwordHash = await hashPassword(newPassword);
    const now = new Date();
    // Completing a reset proves control of the inbox, so the email counts as verified.
    const user = await UserModel.findOneAndUpdate(
      { _id: userId },
      { $set: { passwordHash, passwordChangedAt: now } },
      { new: true },
    ).lean<User>();
    await UserModel.updateOne({ _id: userId, emailVerifiedAt: null }, { $set: { emailVerifiedAt: now } });
    await SessionModel.deleteMany({ userId });
    await this.redis.del(this.failureKey(user!.email));
    await this.audit.record({ action: 'auth.password_reset', actorId: userId, target: { type: 'user', id: userId }, ip: meta.ip });
    await this.mail.dispatch({ to: user!.email, template: 'password_changed', data: { name: user!.name } });
  }

  /** Changes the password, signs out every session, and returns a fresh session for the caller. */
  async changePassword(userId: Types.ObjectId, current: string, next: string, meta: ClientMeta) {
    const user = await UserModel.findById(userId).select('+passwordHash').lean<User>();
    if (!user || !(await verifyPassword(user.passwordHash, current))) {
      throw new AppError(400, 'VALIDATION_FAILED', 'Current password is incorrect', { currentPassword: 'Current password is incorrect' });
    }
    await UserModel.updateOne({ _id: userId }, { $set: { passwordHash: await hashPassword(next), passwordChangedAt: new Date() } });
    await SessionModel.deleteMany({ userId });
    const { rawToken } = await this.createSession(userId, meta);
    await this.audit.record({ action: 'auth.password_changed', actorId: userId, target: { type: 'user', id: userId }, ip: meta.ip });
    await this.mail.dispatch({ to: user.email, template: 'password_changed', data: { name: user.name } });
    return { rawToken };
  }
}
