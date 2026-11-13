import { rateLimit, type Options } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import type { Redis } from 'ioredis';
import type { RequestHandler } from 'express';
import { AppError } from '../errors/AppError.js';

export interface RateLimiterFactory {
  (name: string, opts: { windowMs: number; limit: number; key?: Options['keyGenerator'] }): RequestHandler;
}

/** Redis-backed limiters so limits hold across every API process behind the load balancer. */
export function createRateLimiterFactory(redis: Redis, enabled: boolean): RateLimiterFactory {
  return (name, { windowMs, limit, key }) => {
    if (!enabled) return (_req, _res, next) => next();
    return rateLimit({
      windowMs,
      limit,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      ...(key ? { keyGenerator: key } : {}),
      store: new RedisStore({
        prefix: `rl:${name}:`,
        sendCommand: (command: string, ...args: string[]) => redis.call(command, ...args) as Promise<RedisReply>,
      }),
      handler: (_req, _res, next) => next(new AppError(429, 'RATE_LIMITED', 'Too many requests. Please slow down and try again shortly.')),
    });
  };
}
