# Database Schema (MongoDB)

All timestamps are stored in UTC (`Date`). Every collection uses `strict: 'throw'` so unknown
fields are rejected instead of silently dropped. Indexes are declared on the Mongoose schemas;
outside production they are built at boot, in production by the deploy step.

## Built (Phase 1)

| Collection | Purpose | Key fields | Indexes | Retention |
| --- | --- | --- | --- | --- |
| `users` | Accounts | `email` (lowercase), `name`, `passwordHash` (argon2id, `select: false`), `emailVerifiedAt`, `status`, `passwordChangedAt` | `email` unique | Until account deletion (workflow planned) |
| `sessions` | Server-side sessions | `userId`, `tokenHash` (HMAC), `userAgent`, `ip`, `expiresAt`, `lastSeenAt` | `tokenHash` unique · `userId` · TTL on `expiresAt` | `SESSION_TTL_DAYS` (default 30) |
| `authTokens` | Email-verification and password-reset tokens | `type`, `userId`, `tokenHash`, `expiresAt`, `usedAt` | `tokenHash` unique · `{userId,type}` · TTL on `expiresAt` | 24 h (verify) / 1 h (reset) |
| `organizations` | Tenants | `name`, `slug`, `timezone`, `status` (`active`/`deleted`), `createdBy`, `membershipVersion`, `deletedAt` | `slug` unique · `{createdBy,status}` | Soft delete; purge job planned |
| `orgSlugAliases` | Previous org slugs (redirects, anti-takeover) | `slug`, `orgId` | `slug` unique · `orgId` | Permanent |
| `memberships` | User ↔ org with role | `orgId`, `userId`, `role` | `{orgId,userId}` unique · `userId` · `{orgId,role}` | Deleted on removal |
| `invitations` | Pending/handled invitations | `orgId`, `email`, `role`, `tokenHash`, `invitedBy`, `status`, `expiresAt`, `acceptedBy`, `acceptedAt` | `tokenHash` unique · `{orgId,email}` unique where `status='pending'` · `{orgId,status,createdAt}` | Kept for audit; 7-day validity |
| `auditLogs` | Security/admin trail | `orgId`, `actorType`, `actorId`, `action`, `targetType`, `targetId`, `metadata`, `ip`, `requestId`, `expiresAt` | `{orgId,_id}` · `{actorId,_id}` · TTL on `expiresAt` | `AUDIT_RETENTION_DAYS` (default 730) |

### Access patterns behind the indexes

- Every request: `sessions.findOne({tokenHash})` → `users.findById`.
- Every org route: `organizations.findOne({_id,status})` + `memberships.findOne({orgId,userId})`.
- Org switcher: `memberships.find({userId})` → `organizations.find({_id:{$in}})` (no N+1).
- Members list: `memberships.find({orgId}).sort({_id})` with cursor, then one `users.find({$in})`.
- Audit log: `auditLogs.find({orgId}).sort({_id:-1})` cursor pagination.

### Transactions

Used where several writes must be atomic: org creation (org + owner membership + audit),
slug change (alias + org + audit), role change / removal / invitation acceptance
(membership + `membershipVersion` bump + audit). Requires a replica set (Atlas or local `rs0`).

## Planned (designed, not built)

Bounded documents only; high-volume data in its own collections with TTL or rollups.

| Collection | Phase | Notes |
| --- | --- | --- |
| `websites` | 2 | `orgId`, public `siteKey` (unique), `allowedDomains[]` (bounded, ≤ 20) |
| `analyticsEvents` / `analyticsSessions` / daily rollups | 2–3 | Time-ordered, `{websiteId, ts}` indexes, TTL on raw events; repository interface for later ClickHouse |
| `forms` / `formVersions` / `submissions` | 4 | Immutable published versions; submissions independent, cursor-paginated |
| `leads` | 4 | Dedupe by auditable rule (exact normalized email per org by default) |
| `chatbotFlows` / `chatbotFlowVersions` / `faqEntries` | 5 | Conversations pin the flow version they started on |
| `conversations` / `messages` | 6 | Messages never embedded; client message ids for dedupe |
| `monitors` / `monitoringChecks` / `incidents` | 7 | Checks time-series with TTL; incidents with lifecycle |
| `notifications`, `automationRules`, `automationExecutions` | 7–8 | Execution history with idempotency keys |
| `plans`, `subscriptions`, `usageRecords`, `featureFlags` | 9 | Entitlements separate from flags |
| `outbox`, `eventReceipts` | 2 | Part 32.1 event pipeline |
