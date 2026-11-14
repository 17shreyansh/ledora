/**
 * SPA navigation detection by wrapping history.pushState/replaceState on the history
 * instance (never the prototype). Wrappers call the original with the same `this` and
 * arguments and return its value; exceptions from the original propagate unchanged.
 */
const MARK = '__ledoraWrapped';

type Method = 'pushState' | 'replaceState';
type Marked = History['pushState'] & { [MARK]?: true };

export function patchHistory(onChange: (method: Method, pathChanged: boolean) => void): () => void {
  const undo: Array<() => void> = [];
  const wrap = (method: Method): void => {
    const h = history;
    const original = h[method] as Marked;
    if (typeof original !== 'function' || original[MARK]) return; // idempotent
    const wrapped: Marked = function (this: History, ...args: Parameters<History['pushState']>) {
      let before = '';
      try {
        before = location.pathname;
      } catch {
        // ignore
      }
      const result = original.apply(this, args);
      try {
        onChange(method, location.pathname !== before);
      } catch {
        // never break the host router
      }
      return result;
    };
    wrapped[MARK] = true;
    h[method] = wrapped;
    undo.push(() => {
      if (h[method] === wrapped) h[method] = original;
    });
  };
  wrap('pushState');
  wrap('replaceState');
  return () => undo.forEach((f) => f());
}
