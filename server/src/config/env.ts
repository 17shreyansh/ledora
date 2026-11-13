import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const csv = z
  .string()
  .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean));

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    /** Public URL of the customer app, used in email links. */
    APP_URL: z.url().default('http://localhost:5173'),
    /** Browser origins allowed to call the authenticated API with credentials. */
    CORS_ORIGINS: csv.default(['http://localhost:5173']),
    MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/ledora?replicaSet=rs0'),
    REDIS_URL: z.string().min(1).default('redis://127.0.0.1:6379'),
    /** Secret for HMAC of session/verification tokens and CSRF derivation. ≥ 32 chars. */
    AUTH_SECRET: z.string().min(32),
    SESSION_COOKIE_NAME: z.string().regex(/^[A-Za-z0-9_-]+$/).default('ledora_sid'),
    /** e.g. `.ledora.com` so app.ledora.com and api.ledora.com share the cookie. Empty = host-only. */
    COOKIE_DOMAIN: z.string().optional(),
    COOKIE_SECURE: bool.optional(),
    SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    /** Number of reverse-proxy hops in front of the API (Nginx = 1, Cloudflare + Nginx = 2). */
    TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(1),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    MAIL_TRANSPORT: z.enum(['smtp', 'log']).default('log'),
    SMTP_URL: z.string().optional(),
    MAIL_FROM: z.string().default('Ledora <no-reply@ledora.com>'),
    AUDIT_RETENTION_DAYS: z.coerce.number().int().min(30).max(3650).default(730),
    MAX_ORGS_PER_USER: z.coerce.number().int().min(1).max(1000).default(25),
    /** Set to false only in tests that exercise other behaviour. */
    RATE_LIMIT_ENABLED: bool.default(true),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      if (env.MAIL_TRANSPORT !== 'smtp') {
        ctx.addIssue({ code: 'custom', path: ['MAIL_TRANSPORT'], message: 'must be "smtp" in production' });
      }
      if (env.COOKIE_SECURE === false) {
        ctx.addIssue({ code: 'custom', path: ['COOKIE_SECURE'], message: 'cookies must be Secure in production' });
      }
      if (!env.RATE_LIMIT_ENABLED) {
        ctx.addIssue({ code: 'custom', path: ['RATE_LIMIT_ENABLED'], message: 'cannot be disabled in production' });
      }
    }
    if (env.MAIL_TRANSPORT === 'smtp' && !env.SMTP_URL) {
      ctx.addIssue({ code: 'custom', path: ['SMTP_URL'], message: 'required when MAIL_TRANSPORT=smtp' });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

export interface Config extends Env {
  isProduction: boolean;
  isTest: boolean;
  cookieSecure: boolean;
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');
    // Fail fast with names only — never echo values, they may be secrets.
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  const env = parsed.data;
  return {
    ...env,
    isProduction: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
    cookieSecure: env.COOKIE_SECURE ?? env.NODE_ENV === 'production',
  };
}
