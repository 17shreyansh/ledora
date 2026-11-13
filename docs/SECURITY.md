# Security

What is enforced today, and how. Planned controls are marked as such.

## Authentication
- Passwords: argon2id (`@node-rs/argon2`, m=19 MiB, t=2, p=1). Policy: 10–128 characters, no
  composition rules (NIST 800-63B). Login does not apply the length policy to old passwords.
- Sessions: 256-bit random tokens, stored as HMAC-SHA256 (`AUTH_SECRET`), TTL index expiry,
  cookie `HttpOnly; SameSite=Lax; Secure (prod); Path=/`. Login rotates any existing session
  (fixation). Logout deletes the server record. Password change/reset revokes every session;
  `passwordChangedAt` also invalidates any session created before it.
- Account enumeration: login returns one message for unknown email and wrong password and burns a
  dummy argon2 verification for unknown accounts; forgot-password always returns 202.
  Registration does reveal that an email exists (409) — an accepted trade-off for usability,
  limited to 10 attempts/hour/IP.
- Brute force: per-IP limits on auth routes and a per-email failure counter (10 per 15 min → 429).
- One-time tokens (verify, reset, invitation): 256-bit, stored hashed, single use (atomic
  `findOneAndUpdate`), short expiry; issuing a new one invalidates older ones.

## Authorization and tenant isolation
- Roles `owner > admin > manager > analyst > viewer`; permissions in `packages/shared/src/roles.ts`.
  Viewers cannot read lead contact details (`leads.read` starts at analyst).
- Org routes require a membership looked up server-side; non-members get 404 (no id probing).
- Role grants: only owners grant owner/admin; nobody manages a peer or superior except owners.
- Last-owner invariant is transactional and race-safe (ADR-006).
- Tests prove: another org's data, members, invitations and audit logs are unreachable via
  either org's URLs; viewers cannot mutate; removal cuts access immediately.

## Request hardening
- CSRF: origin guard on unsafe methods + synchronizer token (ADR-004).
- CORS: explicit allowlist (`CORS_ORIGINS`), credentials only for those origins.
- Input: Zod parsing of every body/query/param; JSON ≤ 100 kB; Express simple query parser;
  `strict: 'throw'` schemas; NoSQL operator objects rejected (tested).
- Headers: helmet defaults, API CSP `default-src 'none'; frame-ancestors 'none'`, `no-store`,
  no `X-Powered-By`.
- Rate limits are Redis-backed (shared across processes). They cannot be disabled in production.
- `trust proxy` is set to the configured hop count so client IPs come from the real proxy chain.

## Secrets and logging
- All secrets come from the environment; config validation fails fast and never prints values.
  `.env*` is git-ignored except `.env.example`.
- Logs redact cookies, `Authorization`, CSRF headers, passwords, tokens and hashes; access logs
  drop query strings.
- Audit log records auth events and every org/membership/invitation change with actor, IP and
  request id (no secrets, no message bodies).
- Email templates HTML-escape all user-supplied values (org names, people names).

## Planned controls
- Public ingestion (Phase 2): site keys are identifiers, not secrets; per-key quotas, payload
  schemas, size caps, domain allowlist + Origin checks (treated as a signal, never as auth).
- SSRF protection for monitoring (Phase 7): resolve-then-connect with private/link-local/
  metadata range blocking on every redirect hop, port/protocol allowlist, size/time caps,
  plus egress firewall rules at the infrastructure level.
- Socket.IO (Phase 6): session-authenticated handshake, server-side room authorization per event.
- Admin app (Phase 9): separate admin identities, MFA, sensitive-action re-auth, full audit.
- Account deletion / data export workflows (privacy).

## Reporting
Security issues: email security@ledora.com (address to be provisioned).
