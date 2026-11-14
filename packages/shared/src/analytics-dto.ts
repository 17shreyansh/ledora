import type { BreakdownDimension } from './schemas/analytics.js';

export interface ResolvedRange {
  /** Inclusive start instant (ISO, UTC). */
  start: string;
  /** Exclusive end instant (ISO, UTC). For "today" this is now. */
  end: string;
  /** Calendar dates in the organization's time zone, inclusive. */
  fromDate: string;
  toDate: string;
  timezone: string;
  granularity: 'hour' | 'day';
}

export interface AnalyticsTotals {
  pageviews: number;
  /** Distinct visitor ids. */
  visitors: number;
  sessions: number;
  /** Visitors whose first ever visit (within retention) falls in the range. */
  newVisitors: number;
  /** Custom events (type = "event"). */
  events: number;
  /** Share of sessions with exactly one pageview and no custom events, 0–1; null without sessions. */
  bounceRate: number | null;
  /** Mean seconds between first and last event of a session; null without sessions. */
  avgSessionSeconds: number | null;
  pagesPerSession: number | null;
}

export interface TimeseriesPoint {
  /** Bucket start (ISO, UTC) — an hour or a local midnight in the org time zone. */
  t: string;
  pageviews: number;
  visitors: number;
  sessions: number;
}

export interface AnalyticsOverviewDto {
  range: ResolvedRange;
  previousRange: ResolvedRange | null;
  totals: AnalyticsTotals;
  previousTotals: AnalyticsTotals | null;
  series: TimeseriesPoint[];
  previousSeries: TimeseriesPoint[] | null;
}

export interface BreakdownRow {
  /** Dimension value; "(direct)" / "(none)" / "(not set)" for missing values. */
  key: string;
  visitors: number;
  /** Pageviews for page dimensions, sessions for entry/exit/source dimensions, count for events. */
  value: number;
}

export interface BreakdownDto {
  dimension: BreakdownDimension;
  /** What `value` counts for this dimension. */
  valueLabel: 'pageviews' | 'sessions' | 'events';
  rows: BreakdownRow[];
  /** Total of `value` across all keys (not only the returned rows), for share bars. */
  total: number;
}

export interface RealtimeDto {
  /** Distinct visitors with an event in the last 5 minutes. */
  activeVisitors: number;
  /** Pageviews per minute for the last 30 minutes, oldest first (30 items). */
  perMinute: Array<{ t: string; pageviews: number }>;
  topPages: Array<{ path: string; visitors: number }>;
  /** Most recent events, newest first. No visitor identifiers. */
  recent: Array<{ ts: string; type: 'pageview' | 'event'; name: string | null; path: string; websiteName: string; device: string; browser: string }>;
}
