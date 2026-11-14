# API Reference — `/api/v1`

JSON over HTTPS. Authentication is a session cookie (`ledora_sid`, HttpOnly). Every
`POST/PUT/PATCH/DELETE` made with a session must send `X-CSRF-Token` (value from the session
endpoints below). Requests from a non-allowlisted `Origin` are rejected.

**Errors** — `{ "error": { "code", "message", "fields"?, "requestId" } }`. Codes:
`BAD_REQUEST`, `VALIDATION_FAILED` (with `fields`), `UNAUTHENTICATED`, `FORBIDDEN`,
`CSRF_FAILED`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `EMAIL_NOT_VERIFIED`,
`INVALID_CREDENTIALS`, `TOKEN_INVALID`, `LAST_OWNER`, `PAYLOAD_TOO_LARGE`, `INTERNAL`,
`SERVICE_UNAVAILABLE`.

**Pagination** — list endpoints that can grow return `{ items, nextCursor }`; pass
`?cursor=<nextCursor>`. Cursors are opaque.

Types referenced below are in `packages/shared/src/dto.ts`; request schemas in
`packages/shared/src/schemas/`.

## Health (no `/api/v1` prefix)

| Method | Path | Result |
| --- | --- | --- |
| GET | `/healthz` | `200 {status:"ok"}` — process alive |
| GET | `/readyz` | `200`/`503 {status, checks:{mongo,redis}}` — dependencies reachable |

## Auth

| Method | Path | Body | Success | Notes |
| --- | --- | --- | --- | --- |
| POST | `/auth/register` | `{name,email,password}` | `201 SessionDto` + cookie | Sends verification email. 409 if email exists. 10/h per IP. |
| POST | `/auth/login` | `{email,password}` | `200 SessionDto` + cookie | Same 401 for unknown email and wrong password. 10 failures/15 min per email → 429. Rotates any existing session. |
| POST | `/auth/logout` | — | `204` | Deletes the server-side session. |
| GET | `/auth/session` | — | `200 SessionDto` | 401 if signed out. |
| POST | `/auth/verify-email` | `{token}` | `204` | One-time, 24 h. |
| POST | `/auth/resend-verification` | — | `202` | Auth required. 1/min. Invalidates previous links. |
| POST | `/auth/forgot-password` | `{email}` | `202` | Always 202 (no account enumeration). |
| POST | `/auth/reset-password` | `{token,password}` | `204` | One-time, 1 h. Signs out every session; marks email verified. |

## Current user

| Method | Path | Body | Success |
| --- | --- | --- | --- |
| GET | `/me` | — | `UserDto` |
| PATCH | `/me` | `{name}` | `UserDto` |
| POST | `/me/password` | `{currentPassword,newPassword}` | `{csrfToken}` — all sessions revoked, a new one is issued for this browser |
| GET | `/me/organizations` | — | `OrganizationWithRoleDto[]` |

## Organizations

| Method | Path | Permission | Body | Success |
| --- | --- | --- | --- | --- |
| POST | `/orgs` | verified email | `{name, slug?, timezone?}` | `201 OrganizationWithRoleDto` (caller = owner) |
| GET | `/orgs/:orgId` | `org.read` | — | `OrganizationWithRoleDto` |
| PATCH | `/orgs/:orgId` | `org.update` | `{name?, slug?, timezone?}` | `OrganizationWithRoleDto` |
| DELETE | `/orgs/:orgId` | `org.delete` | `{confirmName}` | `204` (soft delete) |
| GET | `/orgs/:orgId/members` | `members.read` | — | `Paginated<MemberDto>` |
| PATCH | `/orgs/:orgId/members/:userId` | `members.manage` (owners may change their own role) | `{role}` | `MemberDto` |
| DELETE | `/orgs/:orgId/members/:userId` | `members.manage`, or self (leave) | — | `204` |
| GET | `/orgs/:orgId/invitations` | `members.invite` | — | `InvitationDto[]` (pending, unexpired) |
| POST | `/orgs/:orgId/invitations` | `members.invite` + may grant role | `{email,role}` | `201 InvitationDto` |
| DELETE | `/orgs/:orgId/invitations/:id` | `members.invite` | — | `204` |
| GET | `/orgs/:orgId/audit-logs` | `audit.read` | — | `Paginated<AuditLogDto>` |

Non-members get **404** on every `/orgs/:orgId/*` route. Role rules: owners may grant any role;
others may only grant or manage roles strictly below their own. A change that would leave no
owner returns `409 LAST_OWNER`.

## Invitations (token holder)

| Method | Path | Auth | Body | Success |
| --- | --- | --- | --- | --- |
| POST | `/invitations/preview` | none | `{token}` | `InvitationPreviewDto` |
| POST | `/invitations/accept` | session, verified email matching the invitation | `{token}` | `{organization: OrganizationDto}` |

## Plan usage

| Method | Path | Permission | Success |
| --- | --- | --- | --- |
| GET | `/orgs/:orgId/usage` | `org.read` | `UsageDto` — plan, limits and current-month usage (websites, events, team members) |

Limits are enforced server-side: `403 PLAN_LIMIT` (websites, team seats incl. pending invitations), `429 QUOTA_EXCEEDED` (monthly events on the public path).

## Websites

| Method | Path | Permission | Body | Success |
| --- | --- | --- | --- | --- |
| GET | `/orgs/:orgId/websites` | `websites.read` | — | `WebsiteDto[]` |
| POST | `/orgs/:orgId/websites` | `websites.manage` | `{name, domain}` (URLs are normalized to a hostname) | `201 WebsiteDto`; allowed domains default to the domain and its `www.` counterpart |
| GET | `/orgs/:orgId/websites/:id` | `websites.read` | — | `WebsiteDto` |
| GET | `/orgs/:orgId/websites/:id/stats` | `websites.read` | — | `WebsiteStatsDto` (events/pageviews in the last 24 h, last event) |
| PATCH | `/orgs/:orgId/websites/:id` | `websites.manage` | `{name?, allowedDomains? (1–20, *.wildcards), tracking?: {consentRequired?, respectDoNotTrack?}}` | `WebsiteDto` |
| POST | `/orgs/:orgId/websites/:id/rotate-key` | `websites.manage` | — | `WebsiteDto` (old key stops working immediately) |
| DELETE | `/orgs/:orgId/websites/:id` | `websites.manage` | `{confirmName}` | `204` (soft delete; key stops working) |

`installation.status` becomes `verified` only when the server stores a real SDK event from an allowed domain.

## Analytics (`analytics.read`, every role)

Query (all endpoints): `websiteId?` (omit = all websites of the org; another org's id → 404),
`range` = `today | yesterday | 7d | 30d | 90d | custom` (default `7d`; ranges include today),
`from`/`to` = `YYYY-MM-DD` in the **organization's time zone** (custom only, inclusive, ≤ 366 days),
`compare` = `true | false` (default `true`).

| Method | Path | Extra query | Success |
| --- | --- | --- | --- |
| GET | `/orgs/:orgId/analytics/overview` | — | `AnalyticsOverviewDto`: totals + previous-period totals, zero-filled series (hourly for single days, daily otherwise) bucketed at local hour/midnight boundaries |
| GET | `/orgs/:orgId/analytics/breakdown` | `dimension` = `page, entry_page, exit_page, referrer, utm_source, utm_medium, utm_campaign, device, browser, os, event`; `limit` 1–100 (default 10) | `BreakdownDto` (`value` = pageviews for pages, sessions for session dimensions, count for events; `visitors` unique; `total` across all keys) |
| GET | `/orgs/:orgId/analytics/realtime` | — | `RealtimeDto`: active visitors (5 min), pageviews per minute (30 min), top pages, last 20 events without visitor ids |

Definitions: *visitors* = distinct SDK visitor ids with any event in range; *sessions* = sessions
starting in range; *bounce* = a session with ≤ 1 pageview and no custom event; *new visitors* =
visitors first seen in range (within retention); *avg. session duration* = mean of last − first
event time per session.

## Public SDK surface — `/public/v1` (no cookies, `Access-Control-Allow-Origin: *`, never credentials)

| Method | Path | Body | Success | Errors |
| --- | --- | --- | --- | --- |
| GET | `/public/v1/sites/:siteKey/config` | — | `PublicSiteConfig` (cached 60 s) | 404 unknown key |
| POST | `/public/v1/collect` | `IngestBatch` as JSON, `Content-Type: text/plain` (no preflight) | `202 IngestResponse {accepted, duplicates, rejected}` | 400 invalid batch · 403 unknown key / origin not allowed · 413 > 32 KB · 429 rate limit or `QUOTA_EXCEEDED` |

Contract: `packages/shared/src/ingest-contract.ts`. Each event is validated on its own; invalid events are counted in `rejected` without failing the batch. Event ids de-duplicate retries. Bot user agents and `automated: true` batches are accepted but not stored.

SDK files: `GET /sdk/v1/widget.js` (5-minute cache) and `/sdk/v1/widget.<hash>.js` (immutable), served as the CDN origin.

An OpenAPI document is planned (see `KNOWN_ISSUES.md`).
