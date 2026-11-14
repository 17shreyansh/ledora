import { MAX_RANGE_DAYS, type DateRangePreset, type ResolvedRange } from '@ledora/shared';
import { AppError } from '../../common/errors/AppError.js';
import { addDays, dateInZone, daysBetween, startOfDay } from './timezone.js';

export interface Range {
  start: number;
  end: number;
  fromDate: string;
  toDate: string;
  granularity: 'hour' | 'day';
}

export interface RangeRequest {
  range: DateRangePreset;
  from?: string | undefined;
  to?: string | undefined;
}

function window(fromDate: string, toDate: string, tz: string, now: number): Range {
  const start = startOfDay(fromDate, tz);
  const end = Math.min(startOfDay(addDays(toDate, 1), tz), now);
  return { start, end: Math.max(end, start), fromDate, toDate, granularity: fromDate === toDate ? 'hour' : 'day' };
}

/** Resolves a preset or custom range to instants in the organization's time zone. */
export function resolveRange(req: RangeRequest, tz: string, now = Date.now()): { current: Range; previous: Range } {
  const today = dateInZone(now, tz);
  let from: string;
  let to: string;
  switch (req.range) {
    case 'today':
      from = to = today;
      break;
    case 'yesterday':
      from = to = addDays(today, -1);
      break;
    case '7d':
    case '30d':
    case '90d': {
      const days = Number(req.range.slice(0, -1));
      from = addDays(today, -(days - 1));
      to = today;
      break;
    }
    case 'custom': {
      from = req.from!;
      to = req.to!;
      if (from > to) throw AppError.badRequest('End date is before start date', { to: 'End date is before start date' });
      if (daysBetween(from, to) + 1 > MAX_RANGE_DAYS) {
        throw AppError.badRequest(`Choose at most ${MAX_RANGE_DAYS} days`, { from: `Choose at most ${MAX_RANGE_DAYS} days` });
      }
      if (from > today) throw AppError.badRequest('The range is in the future', { from: 'The range is in the future' });
      break;
    }
  }
  const current = window(from, to, tz, now);
  const length = daysBetween(from, to) + 1;
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(length - 1));
  const previous = window(prevFrom, prevTo, tz, now);
  // "Today" so far is compared with the same elapsed part of yesterday.
  if (req.range === 'today') previous.end = previous.start + (current.end - current.start);
  return { current, previous };
}

/** Bucket start instants covering the range (zero-filled series use these). */
export function buckets(r: Range, tz: string): number[] {
  const out: number[] = [];
  if (r.granularity === 'hour') {
    const dayEnd = startOfDay(addDays(r.fromDate, 1), tz);
    for (let t = r.start; t < dayEnd && t <= r.end; t += 3_600_000) out.push(t);
  } else {
    for (let d = r.fromDate; d <= r.toDate; d = addDays(d, 1)) {
      const t = startOfDay(d, tz);
      if (t > r.end) break;
      out.push(t);
    }
  }
  return out;
}

export function toResolved(r: Range, tz: string): ResolvedRange {
  return {
    start: new Date(r.start).toISOString(),
    end: new Date(r.end).toISOString(),
    fromDate: r.fromDate,
    toDate: r.toDate,
    timezone: tz,
    granularity: r.granularity,
  };
}
