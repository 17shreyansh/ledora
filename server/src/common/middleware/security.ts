import type { RequestHandler } from 'express';
import { AppError } from '../errors/AppError.js';
import { safeEqual } from '../utils/tokens.js';

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Rejects state-changing requests whose Origin is not an allowed app origin.
 * Browsers always send Origin on cross-site POST/PUT/PATCH/DELETE, so this blocks
 * cross-site form posts (including login CSRF). Non-browser clients without an
 * Origin pass through; they carry no ambient browser cookies.
 */
export function originGuard(allowed: string[]): RequestHandler {
  const set = new Set(allowed);
  return (req, _res, next) => {
    if (!UNSAFE.has(req.method)) return next();
    const origin = req.get('origin');
    if (origin && !set.has(origin)) return next(new AppError(403, 'CSRF_FAILED', 'Request origin is not allowed'));
    next();
  };
}

/**
 * Synchronizer-token CSRF check for authenticated, state-changing requests.
 * `expected` derives the token from the session; the client sends it as X-CSRF-Token.
 */
export function csrfProtection(expected: (rawSessionToken: string) => string): RequestHandler {
  return (req, _res, next) => {
    if (!UNSAFE.has(req.method) || !req.auth) return next();
    const provided = req.get('x-csrf-token') ?? '';
    if (!provided || !safeEqual(provided, expected(req.auth.rawToken))) {
      return next(new AppError(403, 'CSRF_FAILED', 'Your session token is missing or stale. Refresh the page and try again.'));
    }
    next();
  };
}
