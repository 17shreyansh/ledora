import { isValidTimeZone } from '@ledora/shared';

let cached: string[] | null = null;

/** IANA time zones known to this browser, with UTC first. */
export function timeZoneOptions(): string[] {
  if (cached) return cached;
  let zones: string[] = [];
  try {
    zones = Intl.supportedValuesOf('timeZone');
  } catch {
    zones = [];
  }
  cached = ['UTC', ...zones.filter((z) => z !== 'UTC' && z !== 'Etc/UTC')];
  return cached;
}

export function browserTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && isValidTimeZone(tz) ? tz : 'UTC';
  } catch {
    return 'UTC';
  }
}

const offsetCache = new Map<string, string>();

/** "GMT+2", "GMT-5:30" or "GMT" for the zone's current offset. */
export function timeZoneOffset(tz: string): string {
  const hit = offsetCache.get(tz);
  if (hit) return hit;
  let label = '';
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(new Date());
    label = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
  } catch {
    label = '';
  }
  offsetCache.set(tz, label);
  return label;
}

export function timeZoneLabel(tz: string): string {
  if (tz === 'UTC') return 'UTC';
  const offset = timeZoneOffset(tz);
  const name = tz.replace(/_/g, ' ');
  return offset ? `${name} (${offset})` : name;
}
