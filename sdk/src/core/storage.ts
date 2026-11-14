/**
 * Web Storage wrapper. Access can throw (Safari private mode, sandboxed iframes, blocked
 * site data), so every call is guarded and an in-memory map keeps values for this page load.
 */
export interface Store {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export function createStore(kind: 'localStorage' | 'sessionStorage'): Store {
  const memory = new Map<string, string>();
  const backend = (): Storage | null => {
    try {
      return window[kind];
    } catch {
      return null;
    }
  };
  return {
    get(key) {
      try {
        const v = backend()?.getItem(key);
        if (v != null) return v;
      } catch {
        // fall through to memory
      }
      const m = memory.get(key);
      return m === undefined ? null : m;
    },
    set(key, value) {
      memory.set(key, value);
      try {
        backend()?.setItem(key, value);
      } catch {
        // quota exceeded / unavailable: memory copy is enough
      }
    },
    remove(key) {
      memory.delete(key);
      try {
        backend()?.removeItem(key);
      } catch {
        // ignore
      }
    },
  };
}
