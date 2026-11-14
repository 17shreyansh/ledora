import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ingestBatchHeaderSchema, ingestEventSchema } from '../../packages/shared/src/schemas/websites';
import { start } from '../src/sdk';
import { COLLECT, CONFIG_URL, Ledora, SITE_KEY, makeScript, reset, setup, siteConfig, tick } from './helpers';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(reset);

describe('initialisation', () => {
  it('exposes only track, consent, push and version on window.Ledora', async () => {
    setup();
    expect(Object.keys(Ledora()).sort()).toEqual(['consent', 'push', 'track', 'version']);
    expect(Ledora().version).toBe('1.0.0');
    expect(Object.isFrozen(Ledora())).toBe(true);
    await tick();
  });

  it('does no network work synchronously (boot is deferred)', async () => {
    const h = setup();
    expect(h.fetch).not.toHaveBeenCalled();
    await tick();
    expect(h.fetch).toHaveBeenCalledTimes(1);
    expect(h.fetch.mock.calls[0]?.[0]).toBe(CONFIG_URL);
    expect(h.fetch.mock.calls[0]?.[1]).toMatchObject({ credentials: 'omit' });
  });

  it('sends a valid pageview on init with text/plain and credentials omit', async () => {
    const h = setup();
    await tick();
    await tick(5000);
    expect(h.sent).toHaveLength(1);
    const req = h.sent[0]!;
    expect(req.url).toBe(COLLECT);
    expect(req.init.method).toBe('POST');
    expect(req.init.credentials).toBe('omit');
    expect((req.init.headers as Record<string, string>)['Content-Type']).toBe('text/plain;charset=UTF-8');
    expect(ingestBatchHeaderSchema.safeParse(req.batch).success).toBe(true);
    expect(req.batch).toMatchObject({ v: 1, siteKey: SITE_KEY, sdkVersion: '1.0.0' });
    expect(req.batch.automated).toBeUndefined();
    const [pv] = req.batch.events;
    expect(pv).toMatchObject({ type: 'pageview', url: 'https://shop.example.com/' });
    expect(ingestEventSchema.safeParse(pv).success).toBe(true);
  });

  it('duplicate script / second init is a no-op', async () => {
    const h = setup();
    const first = Ledora();
    const second = start(makeScript({ 'data-ledora-site': SITE_KEY, 'data-ledora-api': 'https://other.test' }));
    expect(second).toBeUndefined();
    expect(Ledora()).toBe(first);
    await tick();
    await tick(5000);
    expect(h.fetch.mock.calls.filter((c) => String(c[0]).endsWith('/config'))).toHaveLength(1);
    expect(h.events().filter((e) => e.type === 'pageview')).toHaveLength(1);
    expect(h.fetch.mock.calls.every((c) => !String(c[0]).startsWith('https://other.test'))).toBe(true);
  });

  it.each([null, 'ldr_short', 'not-a-key', ''])('invalid site key %s: warns once and does nothing else', async (key) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const h = setup({ siteKey: key });
    await tick(60_000);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/site key/i);
    expect(h.fetch).not.toHaveBeenCalled();
    expect((window as unknown as { Ledora?: unknown }).Ledora).toBeUndefined();
    expect(localStorage.length + sessionStorage.length).toBe(0);
  });

  it('falls back to script[data-ledora-site] when currentScript is unavailable', async () => {
    const h = setup({ manual: true });
    h.handle = start(null);
    await tick();
    expect(h.configCalls()).toBe(1);
    h.handle?.destroy();
  });

  it('replays commands queued before the script loaded', async () => {
    const w = window as unknown as { Ledora?: unknown };
    const q: unknown[] = [];
    w.Ledora = q;
    q.push(['track', 'signup', { plan: 'pro' }]);
    q.push(['track', 'cta click']);
    q.push('garbage');
    const h = setup();
    await tick();
    Ledora().push(['track', 'after-load']);
    await tick(5000);
    const names = h.events().map((e) => e.name ?? e.type);
    expect(names).toEqual(['pageview', 'signup', 'cta click', 'after-load']);
    expect(h.events()[1]?.props).toEqual({ plan: 'pro' });
  });

  it('commands called while config is loading are applied once ready', async () => {
    const h = setup();
    Ledora().track('early');
    await tick();
    await tick(5000);
    expect(h.events().map((e) => e.name ?? e.type)).toEqual(['pageview', 'early']);
  });
});

describe('never breaks the host page', () => {
  it('config fetch rejection: no throw, no unhandled rejection, no tracking; retries once after 30s', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (e: unknown) => unhandled.push(e);
    process.on('unhandledRejection', onUnhandled);
    const h = setup({ config: 'reject' });
    expect(() => Ledora().track('x')).not.toThrow();
    await tick();
    expect(h.configCalls()).toBe(1);
    await tick(29_000);
    expect(h.configCalls()).toBe(1);
    await tick(1000);
    expect(h.configCalls()).toBe(2);
    await tick(120_000);
    expect(h.configCalls()).toBe(2);
    expect(h.sent).toHaveLength(0);
    vi.useRealTimers();
    await new Promise((r) => setTimeout(r, 10));
    process.off('unhandledRejection', onUnhandled);
    expect(unhandled).toEqual([]);
  });

  it('config retry succeeds after 30s and then tracks', async () => {
    let calls = 0;
    const h = setup({ manual: true });
    h.fetch.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/config')) {
        calls++;
        return calls === 1
          ? Promise.reject(new TypeError('offline'))
          : Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(siteConfig()) } as Response);
      }
      h.sent.push({ url: String(input), init: init!, batch: JSON.parse(String(init!.body)) });
      return Promise.resolve({ ok: true, status: 202, headers: { get: () => null } } as unknown as Response);
    });
    h.handle = start(document.querySelector('script'));
    await tick(30_000);
    await tick(5000);
    expect(calls).toBe(2);
    expect(h.events().map((e) => e.type)).toEqual(['pageview']);
  });

  it('404 config warns and stays off', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const h = setup({ config: 404 });
    await tick(60_000);
    expect(h.sent).toHaveLength(0);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('tracking.enabled=false does nothing', async () => {
    const h = setup({ config: siteConfig({ tracking: { enabled: false } }) });
    await tick();
    Ledora().track('x');
    await tick(10_000);
    expect(h.sent).toHaveLength(0);
    expect(localStorage.length).toBe(0);
  });

  it('storage that throws: still tracks with in-memory ids and never throws', async () => {
    const boom = () => {
      throw new DOMException('denied', 'SecurityError');
    };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(boom);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(boom);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(boom);
    const h = setup();
    await tick();
    await tick(5000); // first pageview sent
    expect(() => {
      Ledora().track('a'); // queued, then dropped by consent(false)
      Ledora().consent(false);
      Ledora().consent(true);
      Ledora().track('b');
    }).not.toThrow();
    await tick(5000);
    const ev = h.events();
    expect(ev.map((e) => e.name ?? e.type)).toEqual(['pageview', 'pageview', 'b']);
    expect(ev[1]!.visitorId).toBe(ev[2]!.visitorId);
    expect(ev[0]!.visitorId).not.toBe(ev[1]!.visitorId); // consent(false) forgot the old id
  });

  it('window.localStorage getter that throws is tolerated', async () => {
    const desc = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('denied', 'SecurityError');
      },
    });
    try {
      const h = setup();
      await tick();
      await tick(5000);
      expect(h.events()).toHaveLength(1);
    } finally {
      if (desc) Object.defineProperty(window, 'localStorage', desc);
    }
  });

  it('public methods never throw on bad input', async () => {
    setup();
    await tick();
    const L = Ledora();
    expect(() => {
      L.track(undefined);
      L.track({} as unknown as string);
      L.track('ok', 'nope');
      L.push(null);
      L.push(['unknown-method']);
      L.consent('yes' as unknown as boolean);
    }).not.toThrow();
  });
});
