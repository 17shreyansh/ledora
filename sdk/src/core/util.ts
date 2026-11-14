export const noop = (): void => {};

/** Wraps a function so it can never throw into the host page. */
export function safe<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R | undefined {
  return (...args: A) => {
    try {
      return fn(...args);
    } catch {
      return undefined;
    }
  };
}

export function warn(message: string): void {
  try {
    console.warn('[Ledora] ' + message);
  } catch {
    // console may be missing or replaced; never fail because of logging
  }
}

export type Timer = ReturnType<typeof setTimeout>;

/** setTimeout with a guarded callback. */
export function later(fn: () => void, ms: number): Timer {
  return setTimeout(safe(fn), ms);
}

export const now = (): number => Date.now();
