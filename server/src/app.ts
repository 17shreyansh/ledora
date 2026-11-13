import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { loadSession } from './common/middleware/auth.js';
import { errorHandler, notFoundHandler } from './common/middleware/errorHandler.js';
import { requestContext } from './common/middleware/requestContext.js';
import { csrfProtection, originGuard } from './common/middleware/security.js';
import { logger } from './common/logger.js';
import { healthRoutes } from './health/health.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { invitationRoutes, organizationRoutes } from './modules/organizations/organizations.routes.js';
import { meRoutes } from './modules/users/users.routes.js';
import { createServices, type AppDeps, type Services } from './services/container.js';

export function createApp(deps: AppDeps): { app: Express; services: Services } {
  const services = createServices(deps);
  const { config } = deps;
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY);
  app.set('query parser', 'simple'); // never builds nested objects from the query string

  app.use(requestContext);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as express.Request).requestId,
      autoLogging: { ignore: (req) => req.url === '/healthz' || req.url === '/readyz' },
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
      serializers: {
        req: (req: { method: string; url: string }) => ({ method: req.method, url: req.url.split('?')[0] }),
      },
    }),
  );
  app.use(healthRoutes(services));

  // ── Authenticated customer API ──
  const api = express.Router();
  api.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } } }));
  api.use(
    cors({
      origin: config.CORS_ORIGINS,
      credentials: true,
      maxAge: 600,
      exposedHeaders: ['X-Request-Id', 'RateLimit', 'RateLimit-Policy', 'Retry-After'],
    }),
  );
  api.use(express.json({ limit: '100kb' }));
  api.use(cookieParser());
  api.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  api.use(originGuard(config.CORS_ORIGINS));
  api.use(loadSession(config, services.auth));
  api.use(csrfProtection((raw) => services.auth.csrfTokenFor(raw)));
  api.use(services.limiter('api', { windowMs: 60_000, limit: 600 }));

  api.use('/auth', authRoutes(services));
  api.use('/me', meRoutes(services));
  api.use('/orgs', organizationRoutes(services));
  api.use('/invitations', invitationRoutes(services));

  app.use('/api/v1', api);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, services };
}
