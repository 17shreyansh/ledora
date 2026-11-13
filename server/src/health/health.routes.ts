import { Router } from 'express';
import { pingDatabase } from '../database/connection.js';
import { pingRedis } from '../database/redis.js';
import type { Services } from '../services/container.js';

/**
 * Liveness: the process is up and the event loop answers.
 * Readiness: dependencies needed to serve traffic answer. Only up/down is
 * reported — no versions, hosts or error text.
 */
export function healthRoutes(s: Services): Router {
  const r = Router();
  r.get('/healthz', (_req, res) => {
    res.set('Cache-Control', 'no-store').json({ status: 'ok' });
  });
  r.get('/readyz', async (_req, res) => {
    const [mongo, redis] = await Promise.all([pingDatabase(), pingRedis(s.redis)]);
    const ready = mongo && redis;
    res
      .status(ready ? 200 : 503)
      .set('Cache-Control', 'no-store')
      .json({ status: ready ? 'ready' : 'unavailable', checks: { mongo: mongo ? 'up' : 'down', redis: redis ? 'up' : 'down' } });
  });
  return r;
}
