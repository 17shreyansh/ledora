# SDK Integration

**Status: v1.0.0 built** (`sdk/`). Full reference: [`sdk/README.md`](../sdk/README.md).

```html
<script src="https://cdn.ledora.com/v1/widget.js" data-ledora-site="PUBLIC_SITE_KEY" async></script>
```

The site key comes from the website's **Install** tab in the app. Installation is marked verified
only when the server stores a real event from one of the website's allowed domains.

## Guarantees
- **Fail-safe:** every entry point is guarded; the SDK never throws into the host page, adds only
  `window.Ledora`, wraps (never replaces) `history.pushState/replaceState`, and initializes once
  even if the tag is included twice.
- **Small:** 10.9 KB minified, 4.8 KB gzipped (CI-style budget check fails the build above 8 KB).
- **Private by default:** no cookies, no fingerprinting, no form values. Random visitor/session ids
  in first-party `localStorage`. Query strings are stripped except `utm_*`. Consent mode collects and
  stores nothing until `Ledora.consent(true)`; Do Not Track / Global Privacy Control are honoured
  when the site enables it. Headless browsers and `navigator.webdriver` sessions are flagged.
- **Reliable:** batched (`text/plain`, no preflight), retried with exponential backoff + jitter
  (5 attempts), stable event ids so retries are de-duplicated server-side, `Retry-After` honoured on
  429, oversized batches split on 413, `sendBeacon` flush on page hide.

## Versioning and compatibility (Part 32.12)
- Major version in the path (`/v1/`). Within a major, changes are additive only; a breaking change
  ships as `/v2/` and `/v1/` keeps working.
- Each build emits `widget.<hash8>.js` (immutable, cache 1 year) plus the `widget.js` loader
  (cache 5 minutes) and `manifest.json` (`version`, `file`, `sha384` for SRI). Rollback = serve the
  previous build's `widget.js`.
- The SDK reports its version on every batch; the website page shows the last seen version.

## Local development
`npm run build -w @ledora/sdk` → the API serves it at `http://localhost:4000/sdk/v1/widget.js`.
Add `data-ledora-api="http://localhost:4000/public/v1"` to the snippet when testing locally.
