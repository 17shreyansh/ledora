# SDK Integration

**Status: not implemented.** The JavaScript SDK is Phase 2. This page records the agreed public
contract so the API and SDK are built against it; it will be replaced by real integration docs.

```html
<script src="https://cdn.ledora.com/v1/widget.js" data-ledora-site="PUBLIC_SITE_KEY" async></script>
```

Design commitments:
- Versioned URLs (`/v1/`): breaking changes ship only under a new major path; the old major keeps
  working. `widget.js` without a version will 301 to the current major.
- The site key is public and identifies a website; it never authorizes access to leads,
  conversations, organization data or private configuration.
- Non-blocking and fail-safe: all SDK code runs inside try/catch boundaries; failures never throw
  into the host page. Duplicate script tags initialize once.
- Events are batched, size-capped, retried with backoff and carry client event ids for
  server-side dedupe. Consent-aware: no tracking before consent when the site enables consent mode.
- Installation is verified only from server-observed SDK activity (Part 14.3).
