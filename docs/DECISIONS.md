# Architecture Decision Records

Short records of non-obvious decisions. Newest last. Status is Accepted unless noted.

## ADR-001 — Greenfield npm-workspaces monorepo
No existing repository was found (see `PHASE0_AUDIT.md`). One repo holds `packages/shared`
(Zod schemas, DTO types, role/permission rules), `server` (API + workers), `apps/web` (customer
app). `apps/admin` and `sdk/` will be added in their phases. npm workspaces were chosen over
pnpm/turborepo to avoid extra tooling until build times justify it.

## ADR-002 — Modular monolith, separate worker process
One Express codebase with business modules under `server/src/modules/*`. Two process types:
`server.ts` (HTTP) and `worker.ts` (BullMQ consumers). They scale independently under PM2;
no microservices.

## ADR-003 — Opaque server-side sessions in an HttpOnly cookie (not JWT)
Sessions are random 256-bit tokens stored only as HMAC-SHA256 hashes in `sessions`.
Reasons: instant revocation (logout, password change, member removal), no token in JS-readable
storage, simple rotation. Cost: one indexed lookup per request (cacheable in Redis later).
Cookie: `HttpOnly; SameSite=Lax; Secure` (prod), `Domain=.ledora.com` so `app.` and `api.`
share it.

## ADR-004 — CSRF: origin guard + synchronizer token derived from the session
Unsafe requests with a foreign `Origin` are rejected (also covers login CSRF). Authenticated
unsafe requests must carry `X-CSRF-Token` = HMAC(secret, "csrf:" + sessionToken), returned by
the session endpoints. Derivation means nothing extra to store and the token rotates with the
session.

## ADR-005 — 404 for resources in other tenants
Org-scoped routes answer 404 both for non-existent orgs and orgs the caller is not a member of,
so ids cannot be probed. 403 is used only *inside* an org the caller belongs to.

## ADR-006 — Last-owner invariant via per-org version bump
Every membership-changing transaction increments `organizations.membershipVersion`. Concurrent
transactions on the same org then write-conflict, the driver retries one against committed
state, and the "at least one owner" check cannot be bypassed by write skew. Verified by a
mutation test (removing the bump makes the race test fail).

## ADR-007 — Slug history is reserved
When an org changes its slug, the old slug moves to `orgSlugAliases` and can never be claimed by
another org. Hosted form URLs (`ledora.com/{org}/{form}`, Phase 4) will redirect from aliases.

## ADR-008 — Emails go through a queue, never inline
Handlers call a `MailDispatcher`; production uses BullMQ (`email` queue, 6 attempts, exponential
backoff, failed jobs kept 14 days). Tests use an in-memory dispatcher. The `log` transport is
development-only and rejected by production config validation.

## ADR-009 — Zod 4 shared between server and web
`zod@3` had an open high-severity advisory (memory exhaustion on oversized constrained
collections). Both sides use Zod 4 from the shared package so validation rules are identical.

## ADR-010 — No global Mongoose `sanitizeFilter`
It also rewrites the server's own `$in`/`$ne` filters. NoSQL-injection defence instead: every
input is parsed by a Zod schema into primitives before reaching a query, and Express 5's simple
query parser never produces nested objects. A test sends `{"$ne": null}` credentials and expects 400.

## ADR-011 — Integration tests against real MongoDB and Redis
Transactions, unique indexes and TTL behaviour are what we most need to verify, and mocks would
hide them. Tests need a local replica-set `mongod` and Redis (see `TESTING.md`).

## ADR-012 — Event architecture (Part 32.1)
Built in Phase 2. Business events are written to an `outbox` collection inside the same transaction as the
state change and relayed to per-consumer BullMQ queues; consumers dedupe on `(consumer, eventId)`.
High-volume browser analytics use a separate ingestion path and collections. Implemented with one consumer; analytics events stay on the separate high-volume path.

## ADR-013 — Public ingestion is a separate surface
`/public/v1` sits outside `/api/v1` with its own CORS (`*`, no credentials) and no cookie or
session middleware. The SDK posts `text/plain` JSON so browsers send no preflight. Origin
allowlisting is a signal, not authentication; abuse is bounded by rate limits, size caps, schemas
and quotas.

## ADR-014 — Analytics events stay in MongoDB for now
`analyticsEvents` is its own collection with a unique `{websiteId,eventId}` index for dedupe and a
per-event TTL from the plan's retention. All access goes through the ingest/analytics services so
a move to ClickHouse later touches one module. No second database until load justifies it.

## ADR-015 — Event quota: Redis reservation + durable monthly record
Events are reserved atomically in Redis (`INCRBY`, roll back the excess) before insert, then the
stored count is added to `usageRecords`. If Redis loses the counter it is re-seeded from MongoDB.
Duplicates and rejected events release their reservation.

## ADR-016 — Plans live in the database
Default plans are seeded with `$setOnInsert` (never overwriting edits). Limits change without a
deploy; prices are not part of plans (billing is Phase 9).

## ADR-017 — Analytics queries read raw events and session documents (no rollups yet)
Daily rollups in UTC cannot serve organizations in UTC+5:30 or other non-hour offsets, and
per-zone rollups multiply storage. At current scale, indexed aggregations over
`{websiteId, ts}` and `{websiteId, startedAt}` with `$dateTrunc(timezone)` are correct for every
zone. All reads go through `AnalyticsService`, so 30-minute UTC rollups or ClickHouse can replace
the internals without API changes. Revisit when a 90-day overview exceeds ~500 ms p95.

## ADR-018 — Organization time zone defines every range and bucket
"Today", "last 7 days" and custom dates are calendar dates in the org's IANA zone. Instants are
computed with `Intl` (no date library) and tested across DST (23/25-hour days), half-hour offsets,
a zone that skips midnight and 30-minute DST. Ranges include today; the comparison period is the
same number of days immediately before ("today" compares with the same elapsed part of yesterday).
