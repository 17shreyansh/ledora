# Phase 0 — Repository Audit (2026-11-13)

## Finding: there was no existing codebase

The audit was run in a fresh session. No Ledora repository was attached and none of the
account's GitHub repositories is named for Ledora. The only existing asset was the brand logo
(`brand/ledora-logo.svg`). The owner chose a **greenfield build** pushed to a new repository.

| Area | Status | Notes |
| --- | --- | --- |
| Frontend / backend / database / auth / routing / tests / deployment | Missing | Nothing to preserve, migrate or refactor. |
| Brand logo | Working | Kept unmodified at `brand/ledora-logo.svg`. |
| Brand colors | Validated | The logo uses exactly `#7C3AED`, `#5B2BE0`, `#2563EB` (gradient), `#071225` (screen) and `#FFFFFF` (face). These are the design-token brand colors. |
| Prior specification parts 1–32 | Available as prompts | Used as requirements; not stored in a repo before this. |

Because nothing existed, the preservation rules (Part 2.3) had nothing to protect; the
architecture below follows the mandated stack (Part 3) without deviation except where noted
in `docs/DECISIONS.md`.

## Environment observed

- Node.js 22, npm 10. MongoDB 7 (single-node replica set, via Docker) and Redis 7 available
  locally for development and integration tests.
- `fastdl.mongodb.org` is blocked from the build environment, so `mongodb-memory-server` cannot
  download binaries; tests use a real `mongod` instead (see `docs/TESTING.md`).

## Major risks identified up front

1. **Cross-tenant access** — every org-owned query must be scoped server-side. Mitigated in Phase 1
   by the org-context middleware and tenant-isolation tests.
2. **SSRF via monitoring** (Phase 7) — the largest single security risk in the product.
3. **Public ingestion abuse** (Phase 2) — site keys are public; quotas and validation are the defence.
4. **Write skew in membership changes** — e.g. two owners demoting each other. Mitigated with a
   per-organization version document touched inside every membership transaction.
5. **Scope** — Parts 1–32 describe a multi-year product. The roadmap sequences it so the core
   journey (install → see data → capture leads) is never blocked by advanced features.
