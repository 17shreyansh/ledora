import type { Store } from './storage';

export const ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
export const VISITOR_KEY = 'ledora:vid';
export const SESSION_KEY = 'ledora:sid';
export const SESSION_TIMEOUT_MS = 30 * 60_000;

/** Random v4 UUID: crypto.randomUUID (secure contexts only), else getRandomValues. */
export function uuid(): string {
  const c: Crypto | undefined = typeof crypto !== 'undefined' ? crypto : undefined;
  try {
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  } catch {
    // fall back below
  }
  const b = new Uint8Array(16);
  try {
    if (!c) throw 0;
    c.getRandomValues(b);
  } catch {
    for (let i = 0; i < 16; i++) b[i] = (Math.random() * 256) | 0;
  }
  b[6] = ((b[6] as number) & 0x0f) | 0x40;
  b[8] = ((b[8] as number) & 0x3f) | 0x80;
  let h = '';
  for (let i = 0; i < 16; i++) {
    h += ((b[i] as number) + 0x100).toString(16).slice(1);
    if (i === 3 || i === 5 || i === 7 || i === 9) h += '-';
  }
  return h;
}

export interface Ids {
  /** Returns current ids and marks session activity at `at`. */
  touch(at: number): { visitorId: string; sessionId: string };
  clear(): void;
}

/**
 * visitorId: persisted random UUID. sessionId: random UUID stored as "<uuid>.<lastActivityMs>",
 * rotated after 30 minutes without activity. Storage is shared across tabs of the site.
 */
export function createIds(store: Store): Ids {
  let vid: string | null = null;
  let sid: string | null = null;
  let last = 0;
  return {
    touch(at) {
      if (!vid) {
        const v = store.get(VISITOR_KEY);
        vid = v && ID_PATTERN.test(v) ? v : uuid();
      }
      const raw = store.get(SESSION_KEY);
      const dot = raw ? raw.lastIndexOf('.') : -1;
      if (raw && dot > 0) {
        const id = raw.slice(0, dot);
        const t = Number(raw.slice(dot + 1));
        if (ID_PATTERN.test(id) && t > 0 && t >= last) {
          sid = id;
          last = t;
        }
      }
      if (!sid || at - last >= SESSION_TIMEOUT_MS) sid = uuid();
      last = at;
      store.set(VISITOR_KEY, vid);
      store.set(SESSION_KEY, sid + '.' + at);
      return { visitorId: vid, sessionId: sid };
    },
    clear() {
      vid = sid = null;
      last = 0;
      store.remove(VISITOR_KEY);
      store.remove(SESSION_KEY);
    },
  };
}
