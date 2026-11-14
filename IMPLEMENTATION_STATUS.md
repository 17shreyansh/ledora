# Implementation Status

Updated 2026-11-14. Legend: ✅ done and verified · 🟡 partial · ⬜ not started.

## Phase 0 — Audit ✅
Greenfield; see `docs/PHASE0_AUDIT.md`.

## Phase 1 — Foundation ✅ (pending owner review)

| Item | Status | Evidence |
| --- | --- | --- |
| Monorepo, shared contracts (`packages/shared`) | ✅ | 10 unit tests |
| Env config with fail-fast validation, production guards | ✅ | `server/src/config/env.ts` |
| Structured logging, request ids, error envelope | ✅ | `platform.test.ts` |
| Liveness / readiness | ✅ | `platform.test.ts` |
| Register, email verification, login, logout, sessions | ✅ | `auth.test.ts` |
| Forgot / reset / change password with session revocation | ✅ | `auth.test.ts` |
| CSRF (origin guard + synchronizer token), CORS allowlist | ✅ | `auth.test.ts` |
| Rate limits (Redis) + per-email lockout | ✅ | `auth.test.ts` |
| Organizations: create, update, slug aliases, reserved slugs, soft delete, ownership cap | ✅ | `organizations.test.ts` |
| Memberships + five roles + permission matrix | ✅ | `roles.test.ts`, `tenancy.test.ts` |
| Invitations (create, preview, accept, revoke, re-invite) | ✅ | `organizations.test.ts` |
| Last-owner invariant, race-safe | ✅ | concurrent test + mutation check |
| Tenant isolation | ✅ | `tenancy.test.ts` |
| Audit log + API | ✅ | tests assert entries and metadata |
| Email queue (BullMQ) + worker + SMTP/log transports | ✅ | exercised in browser E2E |
| Index build script, PM2 config | ✅ | script run against a real DB |
| Customer app: auth pages, check-email, onboarding, org shell + switcher, overview, members, activity, settings, account | ✅ | 19 web tests; Playwright E2E (below) |
| MUI theme from brand tokens, responsive, accessible basics | ✅ | screenshots reviewed at 1440 px and 390 px |

**Verification run (2026-11-13):** lint 0 problems · typecheck clean · shared 9/9, server 42/42,
web 19/19 tests · production builds succeed · `npm audit --omit=dev` 0 vulnerabilities ·
browser E2E against the real API, worker, MongoDB and Redis: register → verify via emailed link →
create org → invite → second user registers, verifies, accepts → role-limited UI for the invitee →
role change in activity log → last-owner refusal → address change → password change with CSRF
rotation → sign-out and protected-route redirect → mobile drawer; plus invalid links,
forgot/reset password, foreign org id, server field errors, second org create/switch/delete.

## Phase 2 — Websites, SDK, ingestion ✅

| Item | Status | Evidence |
| --- | --- | --- |
| Websites: site keys, allowed domains (+ wildcards), privacy settings, rotate, delete | ✅ | `websites.test.ts` |
| Plans in DB + per-org overrides; limits for websites, seats, monthly events, retention | ✅ | `websites.test.ts`, `organizations.test.ts`, `ingest.test.ts` (quota) |
| Public `/public/v1` config + collect: origin allowlist, per-event validation, PII stripping, bot filter, dedupe, quotas | ✅ | `ingest.test.ts` (+ mutation checks) |
| Site key cannot reach private APIs | ✅ | `ingest.test.ts` |
| Installation verification from server-observed events | ✅ | `ingest.test.ts` + browser E2E |
| Transactional outbox, relay, consumers with receipts; "receiving data" email | ✅ | `outbox.test.ts`, `ingest.test.ts`, browser E2E |
| Browser SDK v1 (4.8 KB gzip, consent, DNT/GPC, SPA, batching, retries, beacon) | ✅ | 71 SDK tests |
| SDK served as CDN origin (immutable hashed files, 5-min loader) | ✅ | E2E (headers checked) |
| Web: websites list/add, install guide with live verification, settings, plan usage, getting-started steps | ✅ | 39 web tests, screenshots |

**Verification run (2026-11-14):** lint clean · typecheck clean · shared 15, server 67, SDK 71,
web 39 tests pass · production builds succeed · `npm audit --omit=dev` 0 vulnerabilities ·
end-to-end with real processes: register → verify → create org → add website → a real page with the
real snippet is visited in Chrome → SDK sends 2 pageviews + 1 custom event (one 202) → website
flips to Verified → owner receives the "receiving data" email → usage shows 3 events → the app's
Install tab shows Verified with real stats. A URL carrying `?utm_source=newsletter&email=x@y.com`
was stored as path `/pricing` with `utm.source=newsletter` and no email anywhere.
(The visitor browser ran with a normal user agent and the automation flag off; headless/automated
traffic is filtered by design, which is itself covered by tests.)

## Phases 3–10 ⬜
See `docs/DEVELOPMENT_ROADMAP.md`. Nothing in these phases is implemented, and the app does not
show navigation for them.
