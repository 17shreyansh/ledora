import { INGEST_LIMITS } from './contract';
import type { PublicSiteConfig } from './contract';
import type { Store } from './storage';

export interface SiteConfig {
  enabled: boolean;
  consentRequired: boolean;
  respectDoNotTrack: boolean;
  flushIntervalMs: number;
  maxBatchSize: number;
}

export const CONFIG_TTL_MS = 5 * 60_000;
export const configKey = (siteKey: string): string => 'ledora:cfg:' + siteKey;

const num = (v: unknown, min: number, max: number, dflt: number): number =>
  typeof v === 'number' && isFinite(v) ? Math.min(max, Math.max(min, Math.floor(v))) : dflt;

/** Validates a PublicSiteConfig; unknown/malformed privacy flags fall back to the privacy-safe value. */
export function normalizeConfig(raw: unknown): SiteConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<PublicSiteConfig>;
  const t = r.tracking;
  if (!t || typeof t !== 'object') return null;
  return {
    enabled: t.enabled === true,
    consentRequired: t.consentRequired !== false,
    respectDoNotTrack: t.respectDoNotTrack !== false,
    flushIntervalMs: num(r.flushIntervalMs, 1000, 60_000, 5000),
    maxBatchSize: num(r.maxBatchSize, 1, INGEST_LIMITS.maxEventsPerBatch, INGEST_LIMITS.maxEventsPerBatch),
  };
}

/** Returns the cached raw config if fresh (5-minute TTL), else null. */
export function readCachedConfig(store: Store, siteKey: string, at: number): unknown {
  try {
    const raw = store.get(configKey(siteKey));
    if (!raw) return null;
    const entry = JSON.parse(raw) as { t?: unknown; c?: unknown };
    const t = entry.t;
    if (typeof t !== 'number' || at - t >= CONFIG_TTL_MS || t > at + 60_000) return null;
    return entry.c;
  } catch {
    return null;
  }
}

export function writeCachedConfig(store: Store, siteKey: string, raw: unknown, at: number): void {
  try {
    store.set(configKey(siteKey), JSON.stringify({ t: at, c: raw }));
  } catch {
    // ignore
  }
}

/** Resolves to the raw config JSON, or null on any failure (never rejects). */
export function fetchConfig(api: string, siteKey: string): Promise<{ raw: unknown; status: number } | null> {
  try {
    return fetch(api + '/sites/' + encodeURIComponent(siteKey) + '/config', {
      method: 'GET',
      credentials: 'omit',
      mode: 'cors',
    })
      .then((res) => (res.ok ? res.json().then((raw: unknown) => ({ raw, status: res.status })) : { raw: null, status: res.status }))
      .catch(() => null);
  } catch {
    return Promise.resolve(null);
  }
}
