import { describe, expect, it } from 'vitest';
import { addDays, dateInZone, daysBetween, offsetAt, startOfDay } from './timezone.js';

const iso = (ms: number) => new Date(ms).toISOString();

describe('timezone helpers', () => {
  it('handles half-hour offsets', () => {
    expect(offsetAt(Date.parse('2026-11-14T00:00:00Z'), 'Asia/Kolkata')).toBe(5.5 * 3_600_000);
    expect(iso(startOfDay('2026-11-14', 'Asia/Kolkata'))).toBe('2026-11-13T18:30:00.000Z');
    expect(dateInZone(Date.parse('2026-11-13T18:29:59Z'), 'Asia/Kolkata')).toBe('2026-11-13');
    expect(dateInZone(Date.parse('2026-11-13T18:30:00Z'), 'Asia/Kolkata')).toBe('2026-11-14');
  });

  it('handles DST transitions (23- and 25-hour days)', () => {
    // US spring forward 2026-03-08, fall back 2026-11-01
    const springLen = startOfDay('2026-03-09', 'America/New_York') - startOfDay('2026-03-08', 'America/New_York');
    const fallLen = startOfDay('2026-11-02', 'America/New_York') - startOfDay('2026-11-01', 'America/New_York');
    expect(springLen).toBe(23 * 3_600_000);
    expect(fallLen).toBe(25 * 3_600_000);
    expect(iso(startOfDay('2026-03-08', 'America/New_York'))).toBe('2026-03-08T05:00:00.000Z');
    expect(iso(startOfDay('2026-11-02', 'America/New_York'))).toBe('2026-11-02T05:00:00.000Z');
  });

  it('handles a zone whose DST jump skips midnight', () => {
    // America/Santiago springs forward at 24:00 → 01:00 (2026-09-06).
    const start = startOfDay('2026-09-06', 'America/Santiago');
    expect(dateInZone(start, 'America/Santiago')).toBe('2026-09-06');
    expect(dateInZone(start - 60_000, 'America/Santiago')).toBe('2026-09-05');
  });

  it('handles 30-minute DST (Lord Howe) and far-east zones', () => {
    const len = startOfDay('2026-10-05', 'Australia/Lord_Howe') - startOfDay('2026-10-04', 'Australia/Lord_Howe');
    expect(len).toBe(23.5 * 3_600_000);
    expect(iso(startOfDay('2026-11-14', 'Pacific/Kiritimati'))).toBe('2026-11-13T10:00:00.000Z');
  });

  it('does calendar arithmetic across month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
    expect(daysBetween('2026-01-01', '2026-12-31')).toBe(364);
  });
});
