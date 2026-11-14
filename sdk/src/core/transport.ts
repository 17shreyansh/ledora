/** Low-level HTTP primitives for the public ingestion API. */
import { noop } from './util';

const TEXT = 'text/plain;charset=UTF-8';

/** POSTs a JSON string as text/plain (CORS-safelisted: no preflight). Never rejects; status 0 = network error. */
export function post(url: string, body: string): Promise<{ status: number; retryAfter: string | null }> {
  try {
    return fetch(url, {
      method: 'POST',
      body,
      headers: { 'Content-Type': TEXT },
      credentials: 'omit',
      mode: 'cors',
    }).then(
      (res) => ({ status: res.status, retryAfter: res.headers ? res.headers.get('Retry-After') : null }),
      () => ({ status: 0, retryAfter: null }),
    );
  } catch {
    return Promise.resolve({ status: 0, retryAfter: null });
  }
}

/** Fire-and-forget delivery that survives page unload: sendBeacon, else fetch keepalive. */
export function beacon(url: string, body: string): void {
  let sent = false;
  try {
    if (typeof navigator.sendBeacon === 'function') {
      sent = navigator.sendBeacon(url, new Blob([body], { type: TEXT }));
    }
  } catch {
    sent = false;
  }
  if (sent) return;
  try {
    fetch(url, {
      method: 'POST',
      body,
      headers: { 'Content-Type': TEXT },
      credentials: 'omit',
      mode: 'cors',
      keepalive: true,
    }).catch(noop);
  } catch {
    // nothing else to try
  }
}

/** Retry-After: delta-seconds or HTTP-date. Returns ms (capped at 1h) or null. */
export function parseRetryAfter(value: string | null, at: number): number | null {
  if (!value) return null;
  const v = value.trim();
  const ms = /^\d+$/.test(v) ? Number(v) * 1000 : Date.parse(v) - at;
  return isFinite(ms) ? Math.min(Math.max(ms, 0), 3_600_000) : null;
}

export const MAX_BACKOFF_MS = 60_000;

/** 1s, 2s, 4s … capped at 60s, with ±20% jitter. `attempt` counts sends already made (1-based). */
export function backoff(attempt: number): number {
  const base = Math.min(MAX_BACKOFF_MS, 1000 * Math.pow(2, Math.max(0, attempt - 1)));
  return Math.min(MAX_BACKOFF_MS, Math.round(base * (0.8 + Math.random() * 0.4)));
}

let encoder: TextEncoder | null | undefined;
/** UTF-8 byte length (upper bound when TextEncoder is unavailable). */
export function byteLength(s: string): number {
  if (encoder === undefined) encoder = typeof TextEncoder === 'function' ? new TextEncoder() : null;
  return encoder ? encoder.encode(s).length : s.length * 3;
}
