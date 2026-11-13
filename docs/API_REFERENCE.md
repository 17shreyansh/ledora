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

An OpenAPI document is planned (see `KNOWN_ISSUES.md`).
