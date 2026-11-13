import type { CookieOptions, RequestHandler, Response } from 'express';
import type { Config } from '../../config/env.js';
import type { AuthService } from '../../modules/auth/auth.service.js';
import { AppError } from '../errors/AppError.js';

export function sessionCookieOptions(config: Config): CookieOptions {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: config.SESSION_TTL_DAYS * 86_400_000,
    ...(config.COOKIE_DOMAIN ? { domain: config.COOKIE_DOMAIN } : {}),
  };
}

export function setSessionCookie(res: Response, config: Config, rawToken: string): void {
  res.cookie(config.SESSION_COOKIE_NAME, rawToken, sessionCookieOptions(config));
}

export function clearSessionCookie(res: Response, config: Config): void {
  const { maxAge: _ignored, ...opts } = sessionCookieOptions(config);
  res.clearCookie(config.SESSION_COOKIE_NAME, opts);
}

/** Resolves the session cookie, if any, into `req.auth`. Never rejects on its own. */
export function loadSession(config: Config, auth: AuthService): RequestHandler {
  return async (req, res, next) => {
    const raw: unknown = req.cookies?.[config.SESSION_COOKIE_NAME];
    if (typeof raw !== 'string' || raw.length === 0) return next();
    const resolved = await auth.resolveSession(raw);
    if (resolved) {
      req.auth = { ...resolved, rawToken: raw };
    } else {
      clearSessionCookie(res, config);
    }
    next();
  };
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.auth) return next(AppError.unauthenticated());
  next();
};
