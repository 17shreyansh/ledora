import type { AnalyticsOverviewDto, TimeseriesPoint } from '@ledora/shared';
import { formatBucket, formatBucketLong } from './format';

export type SeriesMetric = 'visitors' | 'pageviews' | 'sessions';

export const METRIC_LABELS: Record<SeriesMetric, string> = {
  visitors: 'Visitors',
  pageviews: 'Pageviews',
  sessions: 'Sessions',
};

export interface ChartRow {
  /** Bucket start (ISO). */
  t: string;
  /** Short axis label in the org's time zone ("5 AM", "Nov 7"). */
  label: string;
  /** Full label for the tooltip and table. */
  longLabel: string;
  value: number;
  /** The previous period's bucket at the same index, when comparing. */
  previous: number | null;
  previousLabel: string | null;
}

/**
 * One row per bucket of the current period, with the previous period aligned by bucket index
 * (day 1 against day 1, hour 0 against hour 0).
 */
export function buildChartRows(overview: AnalyticsOverviewDto, metric: SeriesMetric, compare: boolean): ChartRow[] {
  const { granularity, timezone } = overview.range;
  const previous: TimeseriesPoint[] | null = compare ? overview.previousSeries : null;
  return overview.series.map((point, i) => {
    const prev = previous?.[i];
    return {
      t: point.t,
      label: formatBucket(point.t, granularity, timezone),
      longLabel: formatBucketLong(point.t, granularity, timezone),
      value: point[metric],
      previous: prev ? prev[metric] : null,
      previousLabel: prev ? formatBucketLong(prev.t, granularity, timezone) : null,
    };
  });
}
