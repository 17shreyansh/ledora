import { describe, expect, it } from 'vitest';
import { buckets, resolveRange } from './range.js';

const iso = (ms: number) => new Date(ms).toISOString();
const NOW = Date.parse('2026-11-14T07:15:00Z'); // 12:45 in Kolkata

describe('resolveRange', () => {
  it('today in a half-hour zone runs from local midnight to now, hourly', () => {
    const { current, previous } = resolveRange({ range: 'today' }, 'Asia/Kolkata', NOW);
    expect(iso(current.start)).toBe('2026-11-13T18:30:00.000Z');
    expect(current.end).toBe(NOW);
    expect(current.granularity).toBe('hour');
    expect(iso(previous.start)).toBe('2026-11-12T18:30:00.000Z');
    expect(previous.end - previous.start).toBe(current.end - current.start);
    const b = buckets(current, 'Asia/Kolkata');
    expect(b).toHaveLength(13); // 00:00 … 12:00 local
    expect(iso(b[1]!)).toBe('2026-11-13T19:30:00.000Z');
  });

  it('last 7 days includes today and compares with the 7 days before', () => {
    const { current, previous } = resolveRange({ range: '7d' }, 'UTC', NOW);
    expect(current.fromDate).toBe('2026-11-08');
    expect(current.toDate).toBe('2026-11-14');
    expect(previous.fromDate).toBe('2026-11-01');
    expect(previous.toDate).toBe('2026-11-07');
    expect(iso(previous.end)).toBe('2026-11-08T00:00:00.000Z');
    expect(buckets(current, 'UTC')).toHaveLength(7);
  });

  it('builds daily buckets on local midnights across DST', () => {
    const { current } = resolveRange({ range: 'custom', from: '2026-10-31', to: '2026-11-02' }, 'America/New_York', NOW);
    expect(buckets(current, 'America/New_York').map(iso)).toEqual([
      '2026-10-31T04:00:00.000Z',
      '2026-11-01T04:00:00.000Z',
      '2026-11-02T05:00:00.000Z',
    ]);
  });

  it('has 25 hourly buckets on a fall-back day', () => {
    const { current } = resolveRange({ range: 'custom', from: '2026-11-01', to: '2026-11-01' }, 'America/New_York', NOW);
    expect(buckets(current, 'America/New_York')).toHaveLength(25);
  });

  it('rejects inverted, too long and future custom ranges', () => {
    expect(() => resolveRange({ range: 'custom', from: '2026-11-10', to: '2026-11-01' }, 'UTC', NOW)).toThrow();
    expect(() => resolveRange({ range: 'custom', from: '2025-01-01', to: '2026-11-01' }, 'UTC', NOW)).toThrow(/366/);
    expect(() => resolveRange({ range: 'custom', from: '2026-12-01', to: '2026-12-02' }, 'UTC', NOW)).toThrow();
  });
});
