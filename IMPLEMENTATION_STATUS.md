# Implementation Status

Updated 2026-11-13. Legend: ✅ done and verified · 🟡 partial · ⬜ not started.

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

## Phases 2–10 ⬜
See `docs/DEVELOPMENT_ROADMAP.md`. Nothing in these phases is implemented, and the app does not
show navigation for them.
