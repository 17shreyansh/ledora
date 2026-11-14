# Testing

## Running

Prerequisites: a MongoDB **replica set** and Redis on localhost (transactions need a replica set).

```bash
docker run -d --name ledora-mongo -p 27017:27017 mongo:7.0 --replSet rs0 --bind_ip_all
docker exec ledora-mongo mongosh --quiet --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27017"}]})'
docker run -d --name ledora-redis -p 6379:6379 redis:7
```

```bash
npm run build -w @ledora/shared
npm test            # all workspaces
npm run lint
npm run typecheck
```

Each server test file creates its own database (`ledora_test_<random>`) and drops it afterwards;
Redis DB 15 is flushed per file. Files run sequentially because rate-limit counters are keyed by IP.

## What is covered (Phase 1)

| Suite | Proves |
| --- | --- |
| `packages/shared/src/roles.test.ts` | Permissions are cumulative by role; viewers lack `leads.read`; only owners delete/bill; grant/manage rules |
| `packages/shared/src/slug.test.ts` | Slugify; reserved routes (`login`, `pricing`, `admin`, `api`, `signup`, …) rejected; shape rules |
| `server/test/platform.test.ts` | Liveness/readiness; request-id propagation; JSON 404; 413 oversized body; 400 malformed JSON; NoSQL operator injection rejected; security headers |
| `server/test/auth.test.ts` | Register/verify/login/logout; hashed session storage; duplicate & weak-password errors; one-time verification links; identical errors for unknown email vs wrong password; logout kills replayed cookies; CSRF token required; foreign Origin rejected (incl. login); CORS allowlist; reset doesn't enumerate, revokes sessions, burns token; change password keeps current session only; per-email lockout; resend throttle |
| `server/test/tenancy.test.ts` | Org B's owner gets 404 on every route of org A (read, update, delete, members, invitations, audit); cross-org member/invitation manipulation via own org fails; malformed ids → 404; auth required; viewer read-only; removal revokes access immediately |
| `server/test/organizations.test.ts` | Verified email required; owner membership; unique/derived slugs; reserved slugs; old slug can't be taken by another org; soft delete with name confirmation; invitation preview/accept, wrong-account rejection, single use, revocation; admins can't create/manage admins/owners; last-owner rule; **concurrent mutual demotion leaves exactly one owner**; ownership hand-over |
| `apps/web` (19 tests) | API client sends credentials, attaches CSRF only to unsafe methods, refreshes the session and retries exactly once on `CSRF_FAILED`; API field errors land on form fields; members page hides invite/role controls from viewers and limits admins' grantable roles; login validation; activity sentences incl. snapshot fallbacks |

The concurrency test was validated by mutation: removing the membership-version bump makes it fail.

| `server/test/websites.test.ts` | Site keys, allowed-domain validation, limit incl. concurrent creates, analysts read-only, cross-tenant 404s |
| `server/test/ingest.test.ts` | Public config is non-sensitive; site key opens no private API; origin allowlist (incl. suffix attacks); per-event validation; 413; dedupe; skew clamp; bots; rotate/delete stop ingestion; PII stripped; verification emits one outbox event; consumer sends once; monthly quota |
| `server/test/outbox.test.ts` | Rolled-back transactions publish nothing; relay publishes once with jobId = eventId; re-relay after crash is a no-op; leased rows skipped |
| `sdk/test/*` (71) | Init safety, duplicate load, consent/DNT/GPC, ids and sessions, SPA pageviews, batching, retries/backoff, 400/403/413/429 handling, beacon, output validated against the server's Zod schemas |

## Browser end-to-end
A Playwright run against the real API, worker, MongoDB and Redis was executed for Phase 1 (flows listed in `IMPLEMENTATION_STATUS.md`). It is not yet automated in CI (`KNOWN_ISSUES.md` #7). Note that sign-up is rate-limited to 10/hour per IP; clear `rl:*` keys in a dev Redis between repeated runs.

## Not yet covered
Automated browser tests in CI, load tests, SDK tests (no SDK yet), socket tests
(no sockets yet). See `KNOWN_ISSUES.md`.
