import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ingestEventSchema } from '../../packages/shared/src/schemas/websites';
import { Ledora, reset, setup, siteConfig, tick } from './helpers';
import { cleanName, cleanProps } from '../src/tracking/events';
import { patchHistory } from '../src/tracking/history';
import { createIds, SESSION_TIMEOUT_MS, uuid } from '../src/core/ids';
import { createStore } from '../src/core/storage';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(reset);

const kinds = (h: ReturnType<typeof setup>) => h.events().map((e) => (e.type === 'pageview' ? 'pv:' + new URL(e.url).pathname : e.name));

describe('pageviews', () => {
  it('on init and on pushState; original pushState still works and returns its value', async () => {
    const original = history.pushState;
    const spy = vi.fn(function (this: History, ...args: Parameters<History['pushState']>) {
      original.apply(this, args);
      return 'original-return';
    });
    history.pushState = spy as unknown as History['pushState'];
    try {
      const h = setup();
      await tick();
      expect(history.pushState).not.toBe(spy); // wrapped
      const state = { page: 2 };
      const ret = (history.pushState as unknown as (...a: unknown[]) => unknown)(state, '', '/products?id=1');
      expect(ret).toBe('original-return');
      expect(spy).toHaveBeenCalledWith(state, '', '/products?id=1');
      expect(spy.mock.contexts[0]).toBe(history);
      expect(location.pathname).toBe('/products');
      expect(history.state).toEqual(state);
      await tick();
      await tick(5000);
      expect(kinds(h)).toEqual(['pv:/', 'pv:/products']);
      for (const e of h.events()) expect(ingestEventSchema.safeParse(e).success).toBe(true);
    } finally {
      history.pushState = original;
    }
  });

  it('exceptions thrown by the original pushState propagate unchanged', async () => {
    setup();
    await tick();
    expect(() => history.pushState(null, '', 'https://evil.example.org/')).toThrow();
  });

  it('replaceState counts only when the path changes; popstate counts; hash ignored by default', async () => {
    const h = setup();
    await tick();
    history.replaceState({ a: 1 }, '', '/?utm_source=x');
    await tick(10);
    history.replaceState(null, '', '/settings');
    await tick(10);
    history.pushState(null, '', '/settings#section');
    await tick(10);
    location.hash = 'other';
    await tick(10);
    history.pushState(null, '', '/a');
    await tick(10);
    history.back();
    await vi.waitFor(() => expect(location.pathname).toBe('/settings'));
    await tick(10);
    await tick(5000);
    expect(kinds(h)).toEqual(['pv:/', 'pv:/settings', 'pv:/a', 'pv:/settings']);
  });

  it('hash routing opt-in reports hash changes', async () => {
    const h = setup({ attrs: { 'data-ledora-hash': 'true' } });
    await tick();
    location.hash = '/inbox';
    await vi.waitFor(() => expect(location.hash).toBe('#/inbox'));
    await tick(10);
    await tick(5000);
    expect(h.events().map((e) => e.url)).toEqual(['https://shop.example.com/', 'https://shop.example.com/#/inbox']);
  });

  it('de-duplicates consecutive pageviews of the same URL within 1s', async () => {
    const h = setup();
    await tick();
    Ledora().consent(false);
    Ledora().consent(true); // re-activation → pageview for same URL (lastPv reset by withdrawal)
    Ledora().consent(true); // no-op
    history.pushState(null, '', '/a');
    await tick(10);
    history.pushState(null, '', '/');
    await tick(10);
    history.pushState(null, '', '/a');
    await tick(10);
    await tick(5000);
    expect(kinds(h)).toEqual(['pv:/', 'pv:/a', 'pv:/', 'pv:/a']);
  });

  it('history patching is idempotent and undoable', () => {
    const original = history.pushState;
    const cb = vi.fn();
    const undo1 = patchHistory(cb);
    const wrapped = history.pushState;
    const undo2 = patchHistory(cb);
    expect(history.pushState).toBe(wrapped);
    history.pushState(null, '', '/p');
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith('pushState', true);
    undo2();
    undo1();
    expect(history.pushState).toBe(original);
    expect(Object.getOwnPropertyNames(History.prototype)).toContain('pushState');
    expect(History.prototype.pushState).toBe(original);
  });
});

describe('custom events', () => {
  it('valid events pass the server schema; long strings are truncated', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const h = setup();
    await tick();
    Ledora().track('  Signup: step/2 ', { plan: 'pro', seats: 3, trial: true, coupon: null, note: 'x'.repeat(500), skip: undefined });
    Ledora().track('n'.repeat(100));
    await tick(5000);
    const [, a, b] = h.events();
    expect(a).toMatchObject({ type: 'event', name: 'Signup: step/2', props: { plan: 'pro', seats: 3, trial: true, coupon: null } });
    expect(a!.props!.note).toHaveLength(200);
    expect(a!.props).not.toHaveProperty('skip');
    expect(b!.name).toHaveLength(64);
    for (const e of h.events()) expect(ingestEventSchema.safeParse(e).success).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    ['empty name', '', undefined],
    ['non-string name', 42, undefined],
    ['bad characters', 'sign<up>', undefined],
    ['props not an object', 'ok', 'str'],
    ['props array', 'ok', [1]],
    ['nested prop', 'ok', { a: { b: 1 } }],
    ['bad key', 'ok', { 'bad key': 1 }],
    ['key too long', 'ok', { ['k'.repeat(41)]: 1 }],
    ['NaN', 'ok', { n: NaN }],
    ['function value', 'ok', { f: () => 1 }],
    ['too many props', 'ok', Object.fromEntries(Array.from({ length: 21 }, (_, i) => ['p' + i, i]))],
  ])('drops invalid event (%s) with one warning', async (_label, name, props) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const h = setup();
    await tick();
    Ledora().track(name, props);
    await tick(5000);
    expect(h.events().map((e) => e.type)).toEqual(['pageview']);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('cleanName/cleanProps unit behaviour', () => {
    expect(cleanName(' a.b:c/d-e_f g ')).toBe('a.b:c/d-e_f g');
    expect(cleanProps(undefined)).toBeUndefined();
    expect(cleanProps({})).toBeUndefined();
    const p = cleanProps(JSON.parse('{"__proto__": 1}'));
    expect(p && Object.keys(p)).toEqual(['__proto__']);
    expect(Object.prototype).not.toHaveProperty('polluted');
  });
});

describe('ids and sessions', () => {
  it('uuid uses getRandomValues when randomUUID is unavailable and matches the id pattern', () => {
    const c = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: (b: Uint8Array) => c.getRandomValues(b) });
    const id = uuid();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    vi.stubGlobal('crypto', undefined);
    expect(uuid()).toMatch(/^[A-Za-z0-9-]{36}$/);
  });

  it('visitor id persists; session rotates after 30 min inactivity', async () => {
    const h = setup();
    await tick();
    Ledora().track('a');
    await tick(29 * 60_000); // activity within the window keeps the session
    Ledora().track('b');
    await tick(SESSION_TIMEOUT_MS + 60_000);
    Ledora().track('c');
    await tick(5000);
    const [pv, a, b, c] = h.events();
    expect(new Set([pv!.visitorId, a!.visitorId, b!.visitorId, c!.visitorId]).size).toBe(1);
    expect(pv!.sessionId).toBe(a!.sessionId);
    expect(b!.sessionId).toBe(a!.sessionId);
    expect(c!.sessionId).not.toBe(b!.sessionId);
    expect(localStorage.getItem('ledora:vid')).toBe(pv!.visitorId);
    expect(localStorage.getItem('ledora:sid')).toMatch(new RegExp('^' + c!.sessionId + '\\.\\d+$'));
  });

  it('reuses ids from storage on the next page load and ignores tampered values', () => {
    const store = createStore('localStorage');
    const t = Date.now();
    const first = createIds(store).touch(t);
    const again = createIds(store).touch(t + 1000);
    expect(again).toEqual(first);
    localStorage.setItem('ledora:vid', '<script>');
    localStorage.setItem('ledora:sid', 'x.1');
    const fresh = createIds(store).touch(t + 2000);
    expect(fresh.visitorId).not.toBe('<script>');
    expect(fresh.sessionId).not.toBe('x');
  });
});

describe('bots', () => {
  it('sets automated: true when navigator.webdriver', async () => {
    Object.defineProperty(navigator, 'webdriver', { value: true, configurable: true });
    try {
      const h = setup();
      await tick();
      await tick(5000);
      expect(h.sent[0]!.batch.automated).toBe(true);
      expect(h.events()).toHaveLength(1); // still tracked, just flagged
    } finally {
      delete (navigator as { webdriver?: boolean }).webdriver;
    }
  });

  it.each([
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (Unknown; Linux x86_64) AppleWebKit/538.1 (KHTML, like Gecko) PhantomJS/2.1.1 Safari/538.1',
    'Sogou web spider/4.0',
    'SomeCrawler/1.0 crawler',
  ])('skips headless/bot user agent: %s', async (ua) => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua);
    const h = setup();
    await tick(10_000);
    expect(h.fetch).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
  });

  it('does not flag ordinary browsers', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Linux; Android 10; Cubot X19) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
    );
    const h = setup({ config: siteConfig() });
    await tick();
    expect(h.configCalls()).toBe(1);
  });
});
