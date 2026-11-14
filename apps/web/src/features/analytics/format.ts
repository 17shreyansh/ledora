/** Formatting helpers for analytics figures. Pure functions, so they are easy to test. */

const fullNumber = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const compactNumber = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });

/** Full under 10,000 ("1,284"), compact above ("12.9K"). */
export function formatCount(value: number): string {
  return Math.abs(value) < 10_000 ? fullNumber.format(value) : compactNumber.format(value);
}

/** Always the full number, for tooltips and tables. */
export function formatExact(value: number): string {
  return fullNumber.format(value);
}

/** Seconds → "m:ss" under an hour, "h:mm:ss" from an hour on. "—" when unknown. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return '—';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** A 0–1 ratio as a percentage: "42%", or "4.2%" below ten. */
export function formatRatio(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const pct = value * 100;
  return `${trimNumber(pct)}%`;
}

export function formatDecimal(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

/** One decimal below ten, none above: 4.2, 12, 140. */
export function trimNumber(value: number): string {
  const abs = Math.abs(value);
  const digits = abs < 10 && abs !== Math.round(abs) ? 1 : 0;
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(value);
}

export type DeltaKind = 'percent' | 'points';
export type DeltaTone = 'good' | 'bad' | 'neutral';

export interface Delta {
  /** "12%", "3.2 pp" — unsigned; direction carries the sign. "—" when there is nothing to compare. */
  text: string;
  direction: 'up' | 'down' | 'flat' | 'none';
  tone: DeltaTone;
  /** Full sentence for screen readers. */
  description: string;
}

/**
 * Change from `previous` to `current`.
 * - percent: relative change; "—" when the previous value is 0 or either value is missing.
 * - points: difference of two 0–1 ratios in percentage points (bounce rate).
 * `upIsGood` decides the tone; bounce rate passes false so a decrease reads as good.
 */
export function computeDelta(
  current: number | null | undefined,
  previous: number | null | undefined,
  { kind = 'percent', upIsGood = true }: { kind?: DeltaKind; upIsGood?: boolean } = {},
): Delta {
  const none: Delta = { text: '—', direction: 'none', tone: 'neutral', description: 'No previous data to compare with' };
  if (current === null || current === undefined || previous === null || previous === undefined) return none;
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return none;
  let change: number;
  let unit: string;
  if (kind === 'points') {
    change = (current - previous) * 100;
    unit = ' pp';
  } else {
    if (previous === 0) return none;
    change = ((current - previous) / Math.abs(previous)) * 100;
    unit = '%';
  }
  const abs = Math.abs(change);
  const rounded = abs < 10 ? Math.round(abs * 10) / 10 : Math.round(abs);
  if (rounded === 0) {
    return { text: `0${unit}`, direction: 'flat', tone: 'neutral', description: 'No change from the previous period' };
  }
  const direction = change > 0 ? 'up' : 'down';
  const good = direction === 'up' ? upIsGood : !upIsGood;
  const text = `${trimNumber(Math.abs(change))}${unit}`;
  const words = kind === 'points' ? `${trimNumber(Math.abs(change))} percentage points` : text;
  return {
    text,
    direction,
    tone: good ? 'good' : 'bad',
    description: `${direction === 'up' ? 'Up' : 'Down'} ${words} from the previous period`,
  };
}

// ── Dates in the organization's time zone ──────────────────────────────────

const formatterCache = new Map<string, Intl.DateTimeFormat>();
function dtf(timeZone: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${timeZone}|${JSON.stringify(options)}`;
  let f = formatterCache.get(key);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat(undefined, { ...options, timeZone });
    } catch {
      f = new Intl.DateTimeFormat(undefined, { ...options, timeZone: 'UTC' });
    }
    formatterCache.set(key, f);
  }
  return f;
}

/** Axis label for a bucket start: "5 AM" for hourly buckets, "Nov 7" for daily ones. */
export function formatBucket(iso: string, granularity: 'hour' | 'day', timeZone: string): string {
  const date = new Date(iso);
  return granularity === 'hour'
    ? dtf(timeZone, { hour: 'numeric' }).format(date)
    : dtf(timeZone, { month: 'short', day: 'numeric' }).format(date);
}

/** Longer label for tooltips and tables: "Fri, Nov 7, 5 AM" / "Fri, Nov 7". */
export function formatBucketLong(iso: string, granularity: 'hour' | 'day', timeZone: string): string {
  const date = new Date(iso);
  return granularity === 'hour'
    ? dtf(timeZone, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric' }).format(date)
    : dtf(timeZone, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

/** A calendar date string ("2026-11-07") as "Nov 7" (optionally with the year). */
function formatCalendarDate(date: string, withYear: boolean): string {
  const [y, m, d] = date.split('-').map(Number);
  return dtf('UTC', withYear ? { month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' }).format(
    new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)),
  );
}

/** "Nov 7 – Nov 13", "Nov 14", or with years when the range is not in the current year. */
export function formatPeriod(fromDate: string, toDate: string, currentYear = new Date().getFullYear()): string {
  const withYear = fromDate.slice(0, 4) !== toDate.slice(0, 4) || Number(toDate.slice(0, 4)) !== currentYear;
  if (fromDate === toDate) return formatCalendarDate(fromDate, withYear);
  return `${formatCalendarDate(fromDate, withYear)} – ${formatCalendarDate(toDate, withYear)}`;
}

/** Today's calendar date ("YYYY-MM-DD") in a time zone. */
export function todayInZone(timeZone: string, now: Date = new Date()): string {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  }
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** "12s ago", "4m ago", "2h ago". */
export function formatAgo(iso: string, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
