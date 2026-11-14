# @ledora/sdk — browser SDK (`widget.js`)

Records pageviews and custom events on a customer's site and sends them to Ledora's public
ingestion API. One script tag; no cookies; safe to drop into any page.

## Install

```html
<script src="https://cdn.ledora.com/v1/widget.js" data-ledora-site="ldr_XXXXXXXXXXXXXXXXXXXX" async></script>
```

For Subresource Integrity, pin the immutable file named in `dist/v1/manifest.json`:

```html
<script src="https://cdn.ledora.com/v1/widget.<hash>.js" integrity="sha384-…" crossorigin="anonymous"
        data-ledora-site="ldr_…" async></script>
```

### Script attributes

| Attribute | Default | Meaning |
| --- | --- | --- |
| `data-ledora-site` | — (required) | Site key, `ldr_` + 20 characters. Missing/invalid → one `console.warn`, nothing else happens. |
| `data-ledora-api` | `https://api.ledora.com/public/v1` | Ingestion base URL (http/https). |
| `data-ledora-consent="required"` | off | Forces consent mode regardless of the server config. |
| `data-ledora-hash="true"` | off | Hash-router sites: count `hashchange` and include `#…` in page URLs. |

Everything else (on/off, consent mode, Do Not Track, flush interval, batch size) comes from the
site's server config (`GET {api}/sites/{siteKey}/config`, cached in `sessionStorage` for 5 minutes).

## API (`window.Ledora`)

```js
Ledora.track('signup', { plan: 'pro', seats: 3 }); // custom event
Ledora.consent(true);   // grant (needed when consent is required)
Ledora.consent(false);  // withdraw: stop tracking, drop queued events, delete Ledora storage
Ledora.version;         // "1.0.0"
Ledora.push(['track', 'signup']); // queued-command form
```

That is the whole surface. Calls made before the script loads are replayed in order after init:

```html
<script>
  window.Ledora = window.Ledora || [];
  Ledora.push(['consent', true]);
  Ledora.push(['track', 'signup', { plan: 'pro' }]);
</script>
```

**Event rules** (the ingestion contract): name ≤ 64 chars of letters, digits, space and `_ . : / -`
(longer names are truncated); `props` is a flat object of at most 20 `string | number | boolean | null`
values, keys `[A-Za-z0-9_.-]` ≤ 40 chars, string values truncated to 200 chars. Invalid events are
dropped with one `console.warn`; `track` never throws.

## What is collected

Pageviews (on load and on SPA navigation: `pushState`, `replaceState` when the path changes,
`popstate`; `hashchange` only with `data-ledora-hash`) and custom events. Each event carries a
random event id, timestamp, page URL, a random visitor id (`localStorage` `ledora:vid`), a random
session id (`localStorage` `ledora:sid`, rotated after 30 minutes of inactivity), and on
pageviews the referrer, screen size and browser language. Consecutive pageviews of the same URL
within 1 s are de-duplicated.

## Privacy behaviour

- **Consent mode** (`tracking.consentRequired` or `data-ledora-consent="required"`): nothing is
  collected, sent or written to storage until `Ledora.consent(true)` is called on that page
  (consent is not persisted by the SDK — your CMP should call it on every page load). Events
  tracked before consent are discarded, not buffered. `consent(false)` works in any mode.
- **Do Not Track / Global Privacy Control**: when the site enables `respectDoNotTrack` and
  `navigator.doNotTrack === '1'` or `navigator.globalPrivacyControl === true`, nothing is tracked
  (consent does not override this).
- **URLs are minimised client-side**: query parameters other than `utm_*` and the hash are
  removed from page URLs; the referrer is reduced to origin + path.
- **Never**: cookies (not read, not set; requests use `credentials: 'omit'`), form field values,
  emails, IPs, fingerprints. Ids are random UUIDs, not derived from the device.
- **Bots**: obvious headless/crawler user agents (`HeadlessChrome`, `PhantomJS`, `bot`, `crawler`,
  `spider`) are not tracked; WebDriver-driven browsers are tracked with `automated: true`.

## Delivery

Events are queued in memory (max 200, oldest dropped) and sent as `POST {api}/collect` with a JSON
body and `Content-Type: text/plain;charset=UTF-8` (no CORS preflight), every `flushIntervalMs` or
as soon as `maxBatchSize` (≤ 25) events are queued, each request ≤ 32 KB. When the page is hidden
or unloaded the queue is sent with `navigator.sendBeacon` (fallback `fetch` with `keepalive`).

| Response | Behaviour |
| --- | --- |
| 2xx | done |
| 400 / other 4xx | dropped, not retried |
| 403 | stop sending for this page load |
| 413 | split into halves, each sent once more |
| 429 | wait `Retry-After` (seconds or HTTP date) or exponential backoff; other sends pause too |
| 5xx / network | retry 1 s, 2 s, 4 s … (max 60 s, ±20 % jitter), 5 attempts per batch, then drop |

Retried events keep their ids, so the server can de-duplicate. If the config request fails the SDK
does not track (fail closed) and retries the config once after 30 s.

## Safety on customer sites

Loaded `async`; the synchronous part only reads the script tag and installs `window.Ledora` —
config and tracking start on a later tick. Every entry point (API methods, listeners, timers,
promise chains) is guarded so the SDK never throws into the page or leaves unhandled rejections.
No globals besides `window.Ledora`, no prototype changes. `history.pushState`/`replaceState` are
wrapped on the `history` object (idempotently) and call the originals with the same `this` and
arguments, returning their value and letting their exceptions propagate. Loading the script twice
is harmless: the second copy is a no-op. Storage access is wrapped; if storage is unavailable ids
live in memory for the page.

## Versioning and compatibility

- The URL path carries the **major** version: `/v1/widget.js`. Within a major, changes are
  additive only — the `window.Ledora` API, attributes and wire format stay backwards compatible —
  so `/v1/widget.js` (short cache TTL) can be updated in place.
- Each build also emits an **immutable, content-hashed** file `/v1/widget.<hash8>.js` (cache
  forever, usable with SRI) and `manifest.json` with `version`, `file`, `sha384`, `bytes`, `gzipBytes`.
- Breaking changes ship as `/v2/`; `/v1/` keeps being served.
- The batch carries `v` (schema version, from `packages/shared/src/ingest-contract.ts`) and `sdkVersion`.

## Size

Budget: ≤ 8 KB gzipped (the build fails above it). v1.0.0: ~10.9 KB minified, ~4.8 KB gzipped —
`npm run build -w @ledora/sdk` prints the exact numbers.

## Development

```sh
npm run build -w @ledora/sdk      # dist/v1/widget.js, widget.<hash>.js, manifest.json
npm run typecheck -w @ledora/sdk
npm run test -w @ledora/sdk       # vitest + jsdom
```

Layout: `src/core/` (contract bridge, storage, ids, config, transport, queue),
`src/tracking/` (event validation, history patching, bot/privacy signals), `src/sdk.ts`
(orchestration and `window.Ledora`), `src/widget.ts` (IIFE entry). The contract is imported by
relative path from `packages/shared/src/ingest-contract.ts` so only that dependency-free file is
bundled. `examples/index.html` is a manual test page (serve `sdk/` over http and open `/examples/`).
