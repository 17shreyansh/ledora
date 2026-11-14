import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { INGEST_LIMITS } from '../src/core/contract';
import { backoff, parseRetryAfter } from '../src/core/transport';
import { COLLECT, Ledora, reset, setup, siteConfig, tick } from './helpers';

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0.5); // jitter factor exactly 1.0
});
afterEach(reset);

const ids = (b: { events: Array<{ id: string }> }) => b.events.map((e) => e.id);

describe('batching', () => {
  it('flushes as soon as maxBatchSize events are queued', async () => {
    const h = setup({ config: siteConfig({ maxBatchSize: 3, flushIntervalMs: 60_000 }) });
    await tick();
    Ledora().track('a');
    expect(h.sent).toHaveLength(0);
    Ledora().track('b');
    await tick();
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0]!.batch.events).toHaveLength(3);
  });

  it('flushes on the configured interval', async () => {
    const h = setup({ config: siteConfig({ flushIntervalMs: 2000 }) });
    await tick();
    Ledora().track('a');
    await tick(1999);
    expect(h.sent).toHaveLength(0);
    await tick(1);
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0]!.batch.events).toHaveLength(2);
    Ledora().track('b');
    await tick(2000);
    expect(h.sent).toHaveLength(2);
  });

  it('caps maxBatchSize at the contract limit and splits by byte size', async () => {
    const h = setup({ config: siteConfig({ maxBatchSize: 1000, flushIntervalMs: 1000 }) });
    await tick();
    const big = Object.fromEntries(Array.from({ length: 20 }, (_, i) => ['k' + i, 'é'.repeat(200)]));
    for (let i = 0; i < 24; i++) Ledora().track('big', big);
    await tick(1000);
    expect(h.sent.length).toBeGreaterThan(1);
    for (const s of h.sent) {
      expect(s.batch.events.length).toBeLessThanOrEqual(INGEST_LIMITS.maxEventsPerBatch);
      expect(new TextEncoder().encode(String(s.init.body)).length).toBeLessThanOrEqual(INGEST_LIMITS.maxBodyBytes);
    }
    expect(h.events()).toHaveLength(25);
  });

  it('caps the queue at 200 events, dropping the oldest', async () => {
    // First request gets 429 Retry-After 600 so later events pile up in the queue.
    const h = setup({ config: siteConfig({ maxBatchSize: 25 }), collect: (n) => (n === 1 ? { status: 429, retryAfter: '600' } : 202) });
    await tick();
    for (let i = 0; i < 24; i++) Ledora().track('e' + i); // + pageview = 25 → immediate flush → 429
    await tick();
    expect(h.sent).toHaveLength(1);
    for (let i = 0; i < 250; i++) Ledora().track('q' + i);
    await tick(600_000);
    const queued = h.sent
      .slice(1)
      .flatMap((s) => s.batch.events.map((e) => e.name))
      .filter((x) => x?.startsWith('q'));
    expect(queued).toHaveLength(200);
    expect(queued[0]).toBe('q50');
    expect(queued[199]).toBe('q249');
  });
});

describe('retries and status handling', () => {
  it('5xx and network errors retry with exponential backoff, keeping event ids; gives up after 5 attempts', async () => {
    const h = setup({ collect: (n) => (n % 2 ? 503 : 'reject') });
    await tick();
    await tick(5000);
    expect(h.sent).toHaveLength(1);
    await tick(999);
    expect(h.sent).toHaveLength(1);
    await tick(1); // 1s
    expect(h.sent).toHaveLength(2);
    await tick(2000); // 2s
    expect(h.sent).toHaveLength(3);
    await tick(4000); // 4s
    expect(h.sent).toHaveLength(4);
    await tick(8000); // 8s
    expect(h.sent).toHaveLength(5);
    await tick(10 * 60_000);
    expect(h.sent).toHaveLength(5);
    const first = ids(h.sent[0]!.batch);
    for (const s of h.sent) expect(ids(s.batch)).toEqual(first);
  });

  it('a retried batch succeeds and later events continue', async () => {
    const h = setup({ collect: (n) => (n === 1 ? 500 : 202) });
    await tick();
    await tick(5000);
    await tick(1000);
    expect(h.sent).toHaveLength(2);
    Ledora().track('next');
    await tick(5000);
    expect(h.sent).toHaveLength(3);
  });

  it('400 is not retried', async () => {
    const h = setup({ collect: () => 400 });
    await tick();
    await tick(5000);
    await tick(10 * 60_000);
    expect(h.sent).toHaveLength(1);
    Ledora().track('still-tracking');
    await tick(5000);
    expect(h.sent).toHaveLength(2);
  });

  it('403 stops sending for this page load', async () => {
    const h = setup({ collect: () => 403 });
    await tick();
    await tick(5000);
    expect(h.sent).toHaveLength(1);
    Ledora().track('x');
    history.pushState(null, '', '/next');
    window.dispatchEvent(new Event('pagehide'));
    await tick(10 * 60_000);
    expect(h.sent).toHaveLength(1);
  });

  it('429 honours Retry-After seconds and delays other flushes too', async () => {
    const h = setup({ collect: (n) => (n === 1 ? { status: 429, retryAfter: '20' } : 202) });
    await tick();
    await tick(5000);
    expect(h.sent).toHaveLength(1);
    Ledora().track('during-backoff');
    await tick(19_999);
    expect(h.sent).toHaveLength(1);
    await tick(1);
    // at t+20s: the retried batch (same ids) and the batch held back during the pause
    expect(h.sent).toHaveLength(3);
    expect(ids(h.sent[1]!.batch)).toEqual(ids(h.sent[0]!.batch));
    expect(h.sent[2]!.batch.events.map((e) => e.name)).toEqual(['during-backoff']);
  });

  it('429 without Retry-After uses exponential backoff', async () => {
    const h = setup({ collect: (n) => (n === 1 ? 429 : 202) });
    await tick();
    await tick(5000);
    await tick(999);
    expect(h.sent).toHaveLength(1);
    await tick(1);
    expect(h.sent).toHaveLength(2);
  });

  it('413 splits the batch into halves and retries each once', async () => {
    const h = setup({
      config: siteConfig({ maxBatchSize: 6, flushIntervalMs: 60_000 }),
      collect: (_n, b) => (b.events.length > 3 ? 413 : b.events.length === 3 && b.events[0]!.type === 'event' ? 413 : 202),
    });
    await tick();
    for (let i = 0; i < 5; i++) Ledora().track('e' + i);
    await tick();
    // 6 → 413 → [3 (pv+e0+e1) ok, 3 (e2..e4) 413 → dropped, not split again]
    expect(h.sent.map((s) => s.batch.events.length)).toEqual([6, 3, 3]);
    const all = ids(h.sent[0]!.batch);
    expect([...ids(h.sent[1]!.batch), ...ids(h.sent[2]!.batch)]).toEqual(all);
    await tick(10 * 60_000);
    expect(h.sent).toHaveLength(3);
  });

  it('pagehide flushes with sendBeacon (text/plain Blob); falls back to fetch keepalive', async () => {
    const beacon = vi.fn((_url: string, _data?: BodyInit | null) => true);
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });
    onTestFinished(() => {
      delete (navigator as { sendBeacon?: unknown }).sendBeacon;
    });
    const h = setup();
    await tick();
    Ledora().track('leaving');
    window.dispatchEvent(new Event('pagehide'));
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(beacon.mock.calls[0]![0]).toBe(COLLECT);
    const blob = beacon.mock.calls[0]![1] as Blob;
    expect(blob.type).toBe('text/plain;charset=utf-8');
    const body = JSON.parse(await blob.text());
    expect(body.events.map((e: { type: string }) => e.type)).toEqual(['pageview', 'event']);

    beacon.mockReturnValue(false);
    Ledora().track('hidden');
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0]!.init).toMatchObject({ keepalive: true, credentials: 'omit' });
    expect(h.sent[0]!.batch.events.map((e) => e.name)).toEqual(['hidden']);
  });
});

describe('helpers', () => {
  it('backoff doubles from 1s and caps at 60s with jitter', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(backoff)).toEqual([1000, 2000, 4000, 8000, 16000, 32000, 60000, 60000]);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(backoff(1)).toBe(800);
  });

  it('parseRetryAfter supports seconds and HTTP dates', () => {
    const now = Date.UTC(2026, 0, 1);
    expect(parseRetryAfter('5', now)).toBe(5000);
    expect(parseRetryAfter(new Date(now + 7000).toUTCString(), now)).toBe(7000);
    expect(parseRetryAfter('soon', now)).toBeNull();
    expect(parseRetryAfter(null, now)).toBeNull();
  });
});
