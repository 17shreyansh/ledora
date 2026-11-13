/**
 * Validates a post-sign-in destination taken from the URL. Only same-origin paths are
 * allowed, so `?returnTo=https://evil.example` cannot turn sign-in into an open redirect.
 */
export function safeReturnTo(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null;
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) < 0x20) return null;
  }
  return value;
}

export function withReturnTo(path: string, returnTo: string | null | undefined, extra?: Record<string, string>): string {
  const params = new URLSearchParams(extra);
  const safe = safeReturnTo(returnTo);
  if (safe) params.set('returnTo', safe);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
