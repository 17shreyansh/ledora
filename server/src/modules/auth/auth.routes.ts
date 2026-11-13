import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  tokenSchema,
  type SessionDto,
} from '@ledora/shared';
import { Router } from 'express';
import { clearSessionCookie, requireAuth, setSessionCookie } from '../../common/middleware/auth.js';
import { authOf, clientMeta } from '../../common/middleware/orgContext.js';
import { toUserDto } from '../../common/serializers.js';
import { parse } from '../../common/validation.js';
import type { Services } from '../../services/container.js';

export function authRoutes(s: Services): Router {
  const r = Router();
  const ipLimit = (name: string, limit: number, windowMs = 15 * 60_000) => s.limiter(name, { windowMs, limit });

  const sessionBody = (rawToken: string, user: Parameters<typeof toUserDto>[0]): SessionDto => ({
    user: toUserDto(user),
    csrfToken: s.auth.csrfTokenFor(rawToken),
  });

  r.post('/register', ipLimit('register', 10, 60 * 60_000), async (req, res) => {
    const input = parse(registerSchema, req.body);
    const { user, rawToken } = await s.auth.register(input, clientMeta(req));
    setSessionCookie(res, s.config, rawToken);
    res.status(201).json(sessionBody(rawToken, user));
  });

  r.post('/login', ipLimit('login', 30), async (req, res) => {
    const input = parse(loginSchema, req.body);
    // Rotate: any session the browser already had is replaced (session-fixation defence).
    if (req.auth) await s.auth.destroySession(req.auth.session._id);
    const { user, rawToken } = await s.auth.login(input, clientMeta(req));
    setSessionCookie(res, s.config, rawToken);
    res.json(sessionBody(rawToken, user));
  });

  r.post('/logout', async (req, res) => {
    if (req.auth) {
      await s.auth.destroySession(req.auth.session._id);
      await s.audit.record({ action: 'auth.logout', actorId: req.auth.user._id, target: { type: 'user', id: req.auth.user._id }, ip: req.ip ?? null });
    }
    clearSessionCookie(res, s.config);
    res.status(204).end();
  });

  r.get('/session', requireAuth, (req, res) => {
    const { user, rawToken } = authOf(req);
    res.json(sessionBody(rawToken, user));
  });

  r.post('/verify-email', ipLimit('verify-email', 30), async (req, res) => {
    const { token } = parse(tokenSchema, req.body);
    await s.auth.verifyEmail(token, clientMeta(req));
    res.status(204).end();
  });

  r.post('/resend-verification', requireAuth, ipLimit('resend-verification', 10), async (req, res) => {
    await s.auth.resendEmailVerification(authOf(req).user);
    res.status(202).json({ ok: true });
  });

  r.post('/forgot-password', ipLimit('forgot-password', 10), async (req, res) => {
    const { email } = parse(forgotPasswordSchema, req.body);
    await s.auth.requestPasswordReset(email);
    res.status(202).json({ ok: true });
  });

  r.post('/reset-password', ipLimit('reset-password', 20), async (req, res) => {
    const { token, password } = parse(resetPasswordSchema, req.body);
    await s.auth.resetPassword(token, password, clientMeta(req));
    clearSessionCookie(res, s.config);
    res.status(204).end();
  });

  return r;
}
