import { INGEST_LIMITS, SITE_KEY_PATTERN } from '@ledora/shared';
import express, { Router, type RequestHandler } from 'express';
import { AppError } from '../../common/errors/AppError.js';
import type { Services } from '../../services/container.js';

/**
 * Public, unauthenticated surface used by the browser SDK on customer websites.
 * Deliberately isolated from /api/v1: no cookies are read, no session exists, CORS
 * never allows credentials, and nothing here can return private data.
 */
export function publicRoutes(s: Services): Router {
  const r = Router();

  const publicCors: RequestHandler = (req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '86400');
    res.set('Access-Control-Expose-Headers', 'Retry-After, RateLimit, RateLimit-Policy');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('X-Content-Type-Options', 'nosniff');
    if (req.method === 'OPTIONS') return void res.status(204).end();
    next();
  };
  r.use(publicCors);

  // Abuse controls: per IP and per site key, shared across processes via Redis.
  const perIp = s.limiter('public-ip', { windowMs: 60_000, limit: 300 });
  const perKey = s.limiter('public-key', {
    windowMs: 60_000,
    limit: 3_000,
    key: (req) => {
      const fromParams = typeof req.params?.siteKey === 'string' ? req.params.siteKey : null;
      const body = req.body as { siteKey?: unknown } | undefined;
      const fromBody = typeof body?.siteKey === 'string' ? body.siteKey : null;
      return `k:${(fromParams ?? fromBody ?? 'none').slice(0, 40)}`;
    },
  });

  r.get('/sites/:siteKey/config', perIp, perKey, async (req, res) => {
    const siteKey = String(req.params.siteKey);
    if (!SITE_KEY_PATTERN.test(siteKey)) throw AppError.notFound('Unknown site key');
    const config = await s.ingest.publicConfig(siteKey);
    res.set('Cache-Control', 'public, max-age=60').json(config);
  });

  // The SDK posts text/plain (a CORS-safelisted type, so no preflight) containing JSON.
  r.post(
    '/collect',
    perIp,
    express.text({ type: ['text/plain', 'application/json'], limit: INGEST_LIMITS.maxBodyBytes }),
    (req, _res, next) => {
      if (typeof req.body !== 'string') return next(AppError.badRequest('Expected a JSON body'));
      try {
        req.body = JSON.parse(req.body) as unknown;
      } catch {
        return next(AppError.badRequest('Request body is not valid JSON'));
      }
      next();
    },
    perKey,
    async (req, res) => {
      const result = await s.ingest.collect(req.body, { origin: req.get('origin'), userAgent: req.get('user-agent') });
      res.status(202).set('Cache-Control', 'no-store').json(result);
    },
  );

  return r;
}
