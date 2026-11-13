/**
 * The last organization the user opened, kept in sessionStorage. It is a non-sensitive
 * convenience (an id the user can see in the URL anyway) and is never used for access decisions.
 */
const KEY = 'ledora.lastOrgId';

export function getLastOrgId(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setLastOrgId(orgId: string): void {
  try {
    sessionStorage.setItem(KEY, orgId);
  } catch {
    // Storage can be unavailable (private mode, quota); the app works without it.
  }
}

export function clearLastOrgId(orgId?: string): void {
  try {
    if (orgId === undefined || sessionStorage.getItem(KEY) === orgId) sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
