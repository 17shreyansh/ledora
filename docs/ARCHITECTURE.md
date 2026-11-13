# Architecture

Status legend: **Built** = implemented and tested · **Planned** = designed, not implemented.

## System overview

| Host | Purpose | Status |
| --- | --- | --- |
| `ledora.com` | Marketing site + hosted forms (`/{org}/{form}`) | Planned |
| `app.ledora.com` | Customer application (`apps/web`) | Built (Phase 1 scope) |
| `admin.ledora.com` | Internal administration (`apps/admin`) | Planned (Phase 9) |
| `api.ledora.com` | REST API `/api/v1` + Socket.IO (`server`) | Built (Phase 1 scope) |
| `cdn.ledora.com` | SDK and static assets; origin = object storage, edge = Cloudflare | Planned (Phase 2) |

```
Browser (app.ledora.com) ──HTTPS, cookie──▶ Cloudflare ─▶ Nginx ─▶ API processes (PM2 cluster)
                                                                    │        │
                                                                    │        └─ enqueue ─▶ Redis (BullMQ) ─▶ Worker processes
                                                                    ▼                                          │
                                                                 MongoDB (replica set / Atlas) ◀───────────────┘
```

## Repository layout

```
packages/shared/   Zod schemas, DTO types, roles & permissions, slug rules (used by server and web)
server/
  src/config/      Environment schema (fails fast on invalid config; never echoes values)
  src/common/      logger (pino + AsyncLocalStorage request ids), errors, validation, middleware
  src/database/    Mongo connection, Redis factory, transaction helper
  src/modules/     auth · users · organizations · memberships (members + invitations) · audit
  src/queues/      BullMQ queue definitions
  src/workers/     BullMQ consumers (email)
  src/services/    cross-module services (mail) and the dependency container
  src/health/      /healthz (liveness), /readyz (readiness)
  src/app.ts       Express app factory (used by server.ts and tests)
  src/server.ts    HTTP entrypoint · src/worker.ts worker entrypoint
apps/web/          React + Vite customer app
docs/              This documentation
```

## Request pipeline (`/api/v1`)

1. `requestContext` — request id (reuses a well-formed inbound `X-Request-Id`), stored in
   AsyncLocalStorage so every log line carries it; echoed in the response and in error bodies.
2. `pino-http` access log (query strings dropped, cookies/auth headers redacted).
3. `helmet` (API CSP `default-src 'none'`), CORS allowlist with credentials, JSON body ≤ 100 kB,
   cookies, `Cache-Control: no-store`.
4. `originGuard` — unsafe methods from a non-allowlisted `Origin` are rejected.
5. `loadSession` — resolves the session cookie into `req.auth`.
6. `csrfProtection` — authenticated unsafe requests need a valid `X-CSRF-Token`.
7. Global Redis-backed rate limit, then per-route limits on sensitive endpoints.
8. Routers. Org-scoped routes run `loadOrgContext` (membership required, else 404) and
   `requirePermission(...)`.
9. `errorHandler` — maps `AppError`, Zod and body-parser errors to `{ error: { code, message, fields?, requestId } }`.
   Unknown errors are logged with stack and returned as a generic 500.

Controllers are thin route handlers; business rules live in services
(`AuthService`, `OrganizationsService`, `MembersService`, `InvitationsService`, `AuditService`)
created once in `services/container.ts`.

## Multi-tenancy

- `User` ↔ `Organization` is many-to-many through `memberships` (`role` per membership).
- Every org-owned document carries `orgId`; every org route resolves the membership of the
  signed-in user from the database — the org id in the URL is only a claim, roles sent by the
  client are never read.
- Permissions are defined once in `packages/shared/src/roles.ts`; the UI uses the same table only
  to hide controls.

## Background jobs

| Queue | Producer | Consumer | Retry | Status |
| --- | --- | --- | --- | --- |
| `email` | auth, invitations | `workers/email.worker.ts` | 6 attempts, exponential from 5 s; failed jobs kept 14 days | Built |
| analytics, monitoring, notifications, automation, exports, maintenance | — | — | — | Planned |

Workers shut down gracefully (finish in-flight jobs, 30 s cap). The API closes its server,
queues, Redis and Mongo on SIGTERM (15 s cap).

## Planned foundations (Part 32)

- **Event pipeline** — transactional outbox → per-consumer queues, `(consumer, eventId)` receipts
  for idempotency, versioned event schemas in `packages/shared`, PII kept out of payloads. See ADR-012.
- **Versioned publishing** — draft + immutable published snapshots for chatbot flows, FAQs, keyword
  rules, forms and widget config; validation gate before publish; rollback = re-point to an older snapshot.
- **Entitlements vs feature flags** — plan entitlements and usage limits enforced server-side in
  services; feature flags evaluated separately (rollout %, per-org grants).
- **Analytics storage** behind a repository interface so high-volume events can move to ClickHouse later.
