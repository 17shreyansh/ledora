const UTM_KEYS = ['source', 'medium', 'campaign', 'term', 'content'] as const;

export interface CleanUrl {
  host: string;
  /** Path only — query strings and fragments are dropped (they often carry personal data). */
  path: string;
  utm: Partial<Record<(typeof UTM_KEYS)[number], string>> | null;
}

export function cleanPageUrl(raw: string): CleanUrl | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  const utm: Partial<Record<(typeof UTM_KEYS)[number], string>> = {};
  for (const k of UTM_KEYS) {
    const v = u.searchParams.get(`utm_${k}`);
    if (v) utm[k] = v.slice(0, 100);
  }
  return {
    host: u.hostname.toLowerCase(),
    path: (u.pathname || '/').slice(0, 512),
    utm: Object.keys(utm).length ? utm : null,
  };
}

export function cleanReferrer(raw: string | undefined, pageHost: string): { host: string | null; path: string | null } {
  if (!raw) return { host: null, path: null };
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return { host: null, path: null };
    const host = u.hostname.toLowerCase();
    // Internal navigation is not a referral.
    if (host === pageHost) return { host: null, path: null };
    return { host, path: (u.pathname || '/').slice(0, 256) };
  } catch {
    return { host: null, path: null };
  }
}
