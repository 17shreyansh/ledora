import { INGEST_LIMITS } from '../core/contract';
import type { PropValue } from '../core/contract';

const NAME_RE = /^[\w .:/-]+$/;
const KEY_RE = /^[\w.-]+$/;
const LANG_RE = /^[A-Za-z0-9-]+$/;

/** Custom event name: trimmed, truncated to the limit; null when unusable. */
export function cleanName(name: unknown): string | null {
  if (typeof name !== 'string') return null;
  const s = name.trim().slice(0, INGEST_LIMITS.maxNameLength).trim();
  return s && NAME_RE.test(s) ? s : null;
}

/**
 * Custom event props. undefined/null → no props; returns null when invalid (non-object, bad key,
 * non-primitive or non-finite value, too many props). Long string values are truncated.
 */
export function cleanProps(props: unknown): Record<string, PropValue> | undefined | null {
  if (props == null) return undefined;
  if (typeof props !== 'object' || Array.isArray(props)) return null;
  const out = Object.create(null) as Record<string, PropValue>;
  let n = 0;
  for (const key of Object.keys(props)) {
    let v = (props as Record<string, unknown>)[key];
    if (v === undefined) continue;
    if (key.length > INGEST_LIMITS.maxPropKeyLength || !KEY_RE.test(key)) return null;
    if (typeof v === 'string') v = v.slice(0, INGEST_LIMITS.maxPropValueLength);
    else if (typeof v === 'number') {
      if (!isFinite(v)) return null;
    } else if (typeof v !== 'boolean' && v !== null) return null;
    if (++n > INGEST_LIMITS.maxProps) return null;
    out[key] = v as PropValue;
  }
  return n ? out : undefined;
}

/**
 * Page URL as reported: origin + path, only utm_* query parameters (the server drops the rest
 * anyway, and they may carry personal data), hash only when hash routing is enabled.
 * null for non-http(s) pages.
 */
export function pageUrl(withHash: boolean): string | null {
  const l = location;
  if (l.protocol !== 'http:' && l.protocol !== 'https:') return null;
  let url = l.origin + l.pathname;
  if (l.search) {
    const kept: string[] = [];
    new URLSearchParams(l.search).forEach((v, k) => {
      if (/^utm_/i.test(k)) kept.push(encodeURIComponent(k) + '=' + encodeURIComponent(v));
    });
    if (kept.length) url += '?' + kept.join('&');
  }
  if (withHash && l.hash) url += l.hash;
  return url.slice(0, INGEST_LIMITS.maxUrlLength);
}

/** document.referrer reduced to origin + path (no query/hash). */
export function referrer(): string | undefined {
  try {
    const r = document.referrer;
    if (!r) return undefined;
    const u = new URL(r);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return undefined;
    return (u.origin + u.pathname).slice(0, INGEST_LIMITS.maxUrlLength);
  } catch {
    return undefined;
  }
}

export function screenSize(): { w: number; h: number } | undefined {
  try {
    const clamp = (n: number) => Math.min(20000, Math.max(0, Math.round(n) || 0));
    return { w: clamp(screen.width), h: clamp(screen.height) };
  } catch {
    return undefined;
  }
}

export function language(): string | undefined {
  try {
    const l = navigator.language;
    return l && LANG_RE.test(l) ? l.slice(0, 35) : undefined;
  } catch {
    return undefined;
  }
}
