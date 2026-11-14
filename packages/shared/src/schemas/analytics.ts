import { z } from 'zod';
import { objectIdSchema } from './common.js';

export const DATE_RANGE_PRESETS = ['today', 'yesterday', '7d', '30d', '90d', 'custom'] as const;
export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number];

/** Calendar date in the organization's time zone. */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const analyticsQuerySchema = z
  .object({
    /** Omit for all websites of the organization. */
    websiteId: objectIdSchema.optional(),
    range: z.enum(DATE_RANGE_PRESETS).default('7d'),
    /** Inclusive start and end dates for range=custom, in the organization's time zone. */
    from: isoDate.optional(),
    to: isoDate.optional(),
    compare: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
  })
  .superRefine((q, ctx) => {
    if (q.range === 'custom') {
      if (!q.from || !q.to) ctx.addIssue({ code: 'custom', path: ['from'], message: 'Custom ranges need from and to' });
      else if (q.from > q.to) ctx.addIssue({ code: 'custom', path: ['to'], message: 'End date is before start date' });
    }
  });
export type AnalyticsQueryInput = z.input<typeof analyticsQuerySchema>;

export const BREAKDOWN_DIMENSIONS = [
  'page',
  'entry_page',
  'exit_page',
  'referrer',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'device',
  'browser',
  'os',
  'event',
] as const;
export type BreakdownDimension = (typeof BREAKDOWN_DIMENSIONS)[number];

export const breakdownQuerySchema = z.object({
  dimension: z.enum(BREAKDOWN_DIMENSIONS),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

/** Longest custom range, in days. */
export const MAX_RANGE_DAYS = 366;
