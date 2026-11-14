# Known Issues

| # | Area | Issue | Impact | Plan |
| --- | --- | --- | --- | --- |
| 2 | Tooling | 7 moderate `npm audit` findings in dev-only lint tooling (`minimatch` via `typescript-eslint`); no fixed release yet. Production dependencies: 0. | None at runtime. | Upgrade when upstream ships a fix. |
| 3 | Auth | Registration returns 409 for an existing email (account enumeration), rate-limited to 10/h/IP. | Low; documented trade-off. | Revisit with an email-first sign-up flow if required. |
| 4 | Orgs | Slug uniqueness between `organizations.slug` and `orgSlugAliases.slug` is checked in application code; the two unique indexes do not cover a simultaneous cross-collection race. | Very unlikely duplicate on concurrent rename + create. | Single `slugs` registry collection with one unique index (Phase 4, with form routing). |
| 5 | Orgs | Soft-deleted organizations are never purged and cannot be restored from the UI. | Data retained indefinitely. | Purge job + admin restore (Phase 9). |
| 6 | Accounts | No email change, account deletion or personal data export yet. | Privacy workflows incomplete. | Phase 9/10. |
| 7 | Tests | Browser E2E scripts were run manually and are not yet in the repo/CI (they read emails from worker logs). | Regressions in UI flows not caught automatically. | Add Playwright suite with a test mail sink to CI. |
| 8 | Docs | No OpenAPI document yet; `docs/API_REFERENCE.md` is hand-written. | Contract drift risk. | Generate from shared Zod schemas. |
| 9 | Web | `vite preview` serves on :4173, which is not in the default `CORS_ORIGINS`. | Add it to `CORS_ORIGINS` when previewing. | — |
| 10 | Web | Activity timestamps use the viewer's browser time zone, not the organization's. | Minor. | Use org time zone with the Phase 3 reporting utilities. |
| 11 | Ops | No metrics endpoint, dashboards, alerting or error-tracking service yet. | Reduced visibility in production. | Phase 10 (32.8). |
| 12 | Ops | Deployment procedure is a reference design; no production environment has been provisioned or tested. | — | First deployment. |
| 13 | Dev | Locally, emails only appear when the worker runs (`npm run dev:worker`). | Confusing on first run. | Documented in README. |
| 14 | SDK/ingest | With `data-ledora-hash="true"` the SDK sends `#/route` URLs, but the server drops fragments, so hash-routed SPAs record every page as `/`. | Wrong paths for hash-router sites (opt-in only). | Phase 3: keep the hash path when the site enables hash routing. |
| 15 | SDK | Routers that captured `history.pushState` before the SDK loaded bypass the wrapper (popstate still works). | Some SPA navigations may be missed. | Document "load the snippet in `<head>`"; consider Navigation API when widely available. |
| 16 | SDK | Consent is not persisted by the SDK; the site's consent tool must call `Ledora.consent(true)` on every page load. | Integration detail. | Documented in `sdk/README.md`. |
