# Environment Variables

Validated at startup by `server/src/config/env.ts`; an invalid value stops the process with the
variable *name* (never its value). Copy `.env.example` to `.env` for local development.

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `NODE_ENV` | no | `development` | `development` · `test` · `production` |
| `PORT` | no | `4000` | API listen port |
| `APP_URL` | no | `http://localhost:5173` | Customer app URL used in email links |
| `CORS_ORIGINS` | no | `http://localhost:5173` | Comma-separated origins allowed to call the API with credentials (also the CSRF origin allowlist) |
| `MONGODB_URI` | no | `mongodb://127.0.0.1:27017/ledora?replicaSet=rs0` | Must point to a replica set (transactions) |
| `REDIS_URL` | no | `redis://127.0.0.1:6379` | Rate limits, queues |
| `AUTH_SECRET` | **yes** | — | ≥ 32 chars. HMAC key for session/one-time tokens and CSRF. Rotating it signs everyone out. |
| `SESSION_COOKIE_NAME` | no | `ledora_sid` | |
| `COOKIE_DOMAIN` | no | host-only | e.g. `.ledora.com` in production |
| `COOKIE_SECURE` | no | `true` in production | Cannot be `false` in production |
| `SESSION_TTL_DAYS` | no | `30` | 1–90 |
| `TRUST_PROXY` | no | `1` | Reverse-proxy hops (Nginx = 1; Cloudflare + Nginx = 2) |
| `LOG_LEVEL` | no | `info` | pino level |
| `MAIL_TRANSPORT` | no | `log` | `smtp` or `log`. `log` prints emails to the log and is rejected in production. |
| `SMTP_URL` | with `smtp` | — | e.g. `smtps://user:pass@smtp.example.com:465` |
| `MAIL_FROM` | no | `Ledora <no-reply@ledora.com>` | |
| `AUDIT_RETENTION_DAYS` | no | `730` | 30–3650 |
| `MAX_ORGS_PER_USER` | no | `25` | Organizations a user may own |
| `RATE_LIMIT_ENABLED` | no | `true` | Cannot be `false` in production |

Web app (`apps/web`, build time): `VITE_API_URL` — API base including `/api/v1`
(default `http://localhost:4000/api/v1`).

Tests: `TEST_MONGODB_URI` (default `mongodb://127.0.0.1:27017/?replicaSet=rs0`),
`TEST_REDIS_URL` (default `redis://127.0.0.1:6379/15`).
