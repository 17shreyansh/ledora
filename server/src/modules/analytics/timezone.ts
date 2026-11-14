/**
 * Time-zone arithmetic without a date library. All instants are UTC epoch ms;
 * calendar dates are "YYYY-MM-DD" strings in a named IANA zone.
 */

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

interface WallTime {
  y: number;
  m: number;
  d: number;
  h: number;
  mi: number;
  s: number;
}

export function wallTime(instant: number, tz: string): WallTime {
  const parts: Record<string, number> = {};
  for (const p of formatter(tz).formatToParts(new Date(instant))) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  return { y: parts.year!, m: parts.month!, d: parts.day!, h: parts.hour! % 24, mi: parts.minute!, s: parts.second! };
}

/** Offset of `tz` from UTC at `instant`, in ms (e.g. +5:30 → 19_800_000). */
export function offsetAt(instant: number, tz: string): number {
  const w = wallTime(instant, tz);
  const asUtc = Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** Calendar date of `instant` in `tz`. */
export function dateInZone(instant: number, tz: string): string {
  const w = wallTime(instant, tz);
  return `${w.y}-${String(w.m).padStart(2, '0')}-${String(w.d).padStart(2, '0')}`;
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * First instant of `date` in `tz`. If local midnight does not exist (a DST jump at
 * 00:00), returns the first instant that does.
 */
export function startOfDay(date: string, tz: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const wallMidnight = Date.UTC(y, m - 1, d);
  let guess = wallMidnight - offsetAt(wallMidnight, tz);
  for (let i = 0; i < 3; i++) {
    const next = wallMidnight - offsetAt(guess, tz);
    if (next === guess) break;
    guess = next;
  }
  // In a gap the guess lands on the previous day; move to the first instant of `date`.
  if (dateInZone(guess, tz) !== date) {
    let lo = guess;
    let hi = guess + 3 * 3_600_000;
    while (hi - lo > 60_000) {
      const mid = lo + Math.floor((hi - lo) / 2);
      if (dateInZone(mid, tz) === date) hi = mid;
      else lo = mid;
    }
    return hi - (hi % 60_000);
  }
  return guess;
}
