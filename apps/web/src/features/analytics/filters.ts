import { DATE_RANGE_PRESETS, MAX_RANGE_DAYS, type DateRangePreset } from '@ledora/shared';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

/** Dashboard filters, as they live in the URL (`?site=&range=&from=&to=&compare=`). */
export interface AnalyticsFilters {
  /** Website id, or null for all websites. */
  site: string | null;
  range: DateRangePreset;
  /** Only for range=custom: inclusive YYYY-MM-DD dates in the organization's time zone. */
  from?: string | undefined;
  to?: string | undefined;
  compare: boolean;
}

export const DEFAULT_FILTERS: AnalyticsFilters = { site: null, range: '7d', compare: true };

export const RANGE_LABELS: Record<DateRangePreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  custom: 'Custom range',
};

const OBJECT_ID = /^[a-f0-9]{24}$/i;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parses "YYYY-MM-DD" to a UTC day number, or null when it isn't a real calendar date. */
function dayNumber(value: string): number | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const time = Date.UTC(y, m - 1, d);
  const date = new Date(time);
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return time / 86_400_000;
}

/** Inclusive number of days from `from` to `to`, or null when either date is invalid. */
export function rangeLengthDays(from: string, to: string): number | null {
  const a = dayNumber(from);
  const b = dayNumber(to);
  return a === null || b === null ? null : b - a + 1;
}

export interface CustomRangeErrors {
  from?: string;
  to?: string;
}

/**
 * Checks a custom range the same way the API does: both dates present and real, the end not before
 * the start, at most MAX_RANGE_DAYS days, and not starting in the future. Returns null when valid.
 */
export function validateCustomRange(from: string, to: string, today?: string): CustomRangeErrors | null {
  const errors: CustomRangeErrors = {};
  if (!from) errors.from = 'Choose a start date';
  else if (dayNumber(from) === null) errors.from = 'Enter a valid date';
  if (!to) errors.to = 'Choose an end date';
  else if (dayNumber(to) === null) errors.to = 'Enter a valid date';
  if (errors.from || errors.to) return errors;

  const length = rangeLengthDays(from, to)!;
  if (length < 1) return { to: 'End date is before start date' };
  if (length > MAX_RANGE_DAYS) return { to: `Choose at most ${MAX_RANGE_DAYS} days` };
  if (today && from > today) return { from: 'The range can’t start in the future' };
  return null;
}

/** Reads filters from URL search params. Anything invalid falls back to its default. */
export function parseFilters(params: URLSearchParams): AnalyticsFilters {
  const site = params.get('site');
  const rawRange = params.get('range');
  const range = (DATE_RANGE_PRESETS as readonly string[]).includes(rawRange ?? '') ? (rawRange as DateRangePreset) : DEFAULT_FILTERS.range;
  const compare = params.get('compare') === 'false' ? false : DEFAULT_FILTERS.compare;
  const filters: AnalyticsFilters = { site: site && OBJECT_ID.test(site) ? site : null, range, compare };

  if (range === 'custom') {
    const from = params.get('from') ?? '';
    const to = params.get('to') ?? '';
    // The future-date check needs the org's "today"; the API still rejects that case.
    if (validateCustomRange(from, to) === null) return { ...filters, from, to };
    return { ...filters, range: DEFAULT_FILTERS.range };
  }
  return filters;
}

/** Writes filters into a copy of `current`, leaving defaults out so URLs stay short. */
export function writeFilters(current: URLSearchParams, filters: AnalyticsFilters): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const key of ['site', 'range', 'from', 'to', 'compare']) next.delete(key);
  if (filters.site) next.set('site', filters.site);
  if (filters.range !== DEFAULT_FILTERS.range) next.set('range', filters.range);
  if (filters.range === 'custom' && filters.from && filters.to) {
    next.set('from', filters.from);
    next.set('to', filters.to);
  }
  if (filters.compare !== DEFAULT_FILTERS.compare) next.set('compare', String(filters.compare));
  return next;
}

/** The dashboard filters from the URL, and a setter that writes changes back to it. */
export function useAnalyticsFilters(): [AnalyticsFilters, (patch: Partial<AnalyticsFilters>) => void] {
  const [params, setParams] = useSearchParams();
  // useSearchParams returns a new object only when the query string changes.
  const filters = useMemo(() => parseFilters(params), [params]);
  const update = useCallback(
    (patch: Partial<AnalyticsFilters>) => {
      setParams((prev) => {
        const merged = { ...parseFilters(prev), ...patch };
        if (merged.range !== 'custom') {
          merged.from = undefined;
          merged.to = undefined;
        }
        return writeFilters(prev, merged);
      });
    },
    [setParams],
  );
  return [filters, update];
}
