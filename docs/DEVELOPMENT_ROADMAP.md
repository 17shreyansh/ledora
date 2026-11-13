# Development Roadmap

Phases follow Part 24, re-ordered only where a Part 32 foundation must exist before the features
that depend on it. Each phase ends with an **exit gate**: the phase is not done until every gate
item is demonstrably true (tests, or a recorded manual check).

## Re-ordering decisions

| Change | Why |
| --- | --- |
| Event outbox + receipts move into **Phase 2** (was implicit) | Analytics, notifications, automation and integrations all consume the same events; building them first avoids four bespoke pipelines. |
| Minimal **plan entitlements** (website count, monthly event quota) move into **Phase 2** (rest stays Phase 9) | Public ingestion must be quota-limited from day one; a hidden UI is not a limit. |
| **Versioned publishing** module built in **Phase 4** with forms, reused by chatbot (Phase 5) and widget config | One draft/published/rollback model for every customer-facing configuration (Part 32.5). |
| Flow validator ships **with** the chatbot builder (Phase 5), not after | Part 32.2: an invalid flow must never be publishable. |

## Phases

| Phase | Scope | Exit gate | Status |
| --- | --- | --- | --- |
| 0 Audit | Repository audit, risks, plan | `docs/PHASE0_AUDIT.md` | Done |
| 1 Foundation | Monorepo, shared contracts, config, logging, errors, auth (verify/reset/change), orgs, memberships, invitations, roles, audit log, health, email queue, customer app shell + account/org/team screens | Tenant-isolation, CSRF, auth and race tests pass; lint/typecheck/build clean; end-to-end sign-up → org → invite → accept works in a browser | In review |
| 2 Websites, SDK, ingestion | Websites + site keys + domain allowlist; SDK v1 (batching, retry, dedupe ids, consent, duplicate-load guard); CDN origin + versioned paths; public ingest endpoint (quotas, schemas, size caps, bot filter); installation verification from server-observed events; event outbox + receipts; minimal entitlements | Invalid/oversized/duplicate events rejected (tests); site key cannot reach any private API (tests); SDK error cannot throw into host page (tests); install verified only by real events | Next |
| 3 Analytics | Sessionization, pageviews, sources, UTM, devices, rollups, timezone-aware reporting, dashboards, date ranges + comparisons, real-time view, retention TTLs | Every metric traceable to stored events; DST/timezone tests; rollups match raw counts | |
| 4 Forms + leads | Publishing module (drafts, immutable snapshots, validation gate, rollback); form builder; shared renderer for embedded and hosted forms (`ledora.com/{org}/{form}`, aliases redirect, reserved routes); submissions; spam; lead creation + auditable dedupe | Unpublished form rejects submissions; slug change redirects; hosted and embedded share one engine (tests) | |
| 5 Chatbot | Flow editor, deterministic engine pinned to flow version, FAQ + keyword matching, graph validator (unreachable nodes, broken edges, missing fallback), test console with trace, publish/rollback | Invalid flow cannot publish; running conversations keep their version (tests) | |
| 6 Live inbox | Conversations + messages (separate collections), Socket.IO with session auth and room authorization, persist-before-ack, client message ids, reconnect resync, assignment with optimistic concurrency, notes, unread counts | Two agents cannot overwrite each other; reconnect loses nothing; internal notes never reach visitors (tests) | |
| 7 Monitoring + notifications | HTTP/DNS/SSL checks, SSRF-hardened fetcher, incidents with recovery, notification engine (templates, preferences, dedupe, retries) | SSRF suite (private ranges, IPv6, metadata IPs, DNS rebinding, redirect chains) passes; one alert per incident | |
| 8 Automation | Trigger → conditions → actions, versioned rules, execution history, retries, idempotency; no user code | Duplicate event never runs an action twice (tests) | |
| 9 Admin + commercial | `admin.ledora.com`, admin RBAC + MFA, plans, full entitlements, usage, feature flags (rollout %, grants), billing foundation | Limits enforced server-side (tests); admin actions audited | |
| 10 Hardening | Security review, load tests, observability dashboards + alerts, backup restore drill, runbooks, docs | Restore drill done; SLOs defined; known issues triaged | |

## Part 32 classification

| Capability | MVP | Post-launch | Advanced | Enterprise |
| --- | --- | --- | --- | --- |
| 32.1 Events | Envelope v1, outbox, idempotent consumers, PII-free payloads, retention | Replay, schema registry view | Warehouse export | Per-org retention |
| 32.2 Chatbot testing | Graph validator blocking publish, draft simulator | Trace panel (conditions, FAQ/keyword matches) | Saved scenarios / regression runs | — |
| 32.3 Automation | Built-in new-lead notification only | Rules engine with 4 actions + history | Visual builder, webhooks, more triggers | Approval, per-team rule sets |
| 32.4 Inbox | Persist-then-ack, dedupe, resync, assignment, optimistic concurrency, unread | Notes, tags, search, filters, priority, lead link, visitor history | Response-time metrics, availability, team routing | SLA policies |
| 32.5 Publishing | Drafts, immutable snapshots, validate-before-publish, rollback (forms, chatbot, widget) | Change summaries, history, diff | Scheduled publish | Approval workflow |
| 32.6 Onboarding | Real-progress checklist, install snippet, server-verified install, empty states | Sample chatbot/form templates, contextual help | Product tours | Assisted onboarding |
| 32.7 Integrations | Transactional email, signed outbound webhooks | Google Sheets, delivery history UI | CRM / marketing connectors | Chat platforms, scoped permissions |
| 32.8 Observability | Structured logs, request ids, health/readiness, failed-job inspection | Metrics dashboards, alerting | SLO tracking | Public status page |
| 32.9 Flags & entitlements | Entitlements + server-side limits, boolean flags | Rollout %, temporary grants | Admin audit views | Contract entitlements |
| 32.10 Reliability | Idempotency keys, bounded docs, TTLs, UTC + org timezone, backups | Automated restore drills | PITR SLAs | Data residency |
| 32.11 Form routing | Hosted URLs, reserved routes, alias redirects, published check | SEO metadata editor | Custom domains | — |
| 32.12 SDK releases | Major-versioned paths, config schemaVersion, release notes | Canary channel, staged rollout | Per-site integration health | Pinned versions |

Already delivered from this table in Phase 1: structured logs + request ids + health/readiness
(32.8), UTC storage and per-org time zone setting (32.10), reserved-route protection and slug
aliases (32.11), audit trail (32.8).
