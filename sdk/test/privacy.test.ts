import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Ledora, SITE_KEY, reset, setup, siteConfig, tick } from './helpers';

const storageKeys = () => [
  ...Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)),
  ...Array.from({ length: sessionStorage.length }, (_, i) => sessionStorage.key(i)),
];

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(reset);

describe('consent', () => {
  it('consent required by config: nothing sent or stored until consent(true)', async () => {
    const h = setup({ config: siteConfig({ tracking: { consentRequired: true } }) });
    await tick();
    Ledora().track('before-consent');
    history.pushState({}, '', '/pricing');
    await tick(60_000);
    expect(h.sent).toHaveLength(0);
    expect(storageKeys()).toEqual([]);

    Ledora().consent(true);
    Ledora().track('after-consent');
    await tick(5000);
    expect(h.events().map((e) => e.name ?? e.type)).toEqual(['pageview', 'after-consent']);
    expect(h.events()[0]!.url).toBe('https://shop.example.com/pricing');
    expect(storageKeys().sort()).toEqual(['ledora:cfg:' + SITE_KEY, 'ledora:sid', 'ledora:vid']);
  });

  it('data-ledora-consent="required" forces consent mode even if config does not require it', async () => {
    const h = setup({ attrs: { 'data-ledora-consent': 'required' } });
    await tick();
    await tick(10_000);
    expect(h.sent).toHaveLength(0);
    expect(storageKeys()).toEqual([]);
    Ledora().consent(true);
    await tick(5000);
    expect(h.events()).toHaveLength(1);
  });

  it('consent(false) stops tracking, drops the queue and deletes Ledora storage', async () => {
    localStorage.setItem('host-app', 'keep me');
    const h = setup();
    await tick();
    Ledora().track('queued-not-sent');
    expect(storageKeys()).toContain('ledora:vid');
    Ledora().consent(false);
    expect(storageKeys()).toEqual(['host-app']);
    Ledora().track('after-withdrawal');
    history.pushState({}, '', '/x');
    await tick(60_000);
    expect(h.sent).toHaveLength(0);
    expect(storageKeys()).toEqual(['host-app']);
  });

  it('consent(false) queued before init clears storage immediately', async () => {
    localStorage.setItem('ledora:vid', 'old-visitor-id-1234');
    (window as unknown as { Ledora: unknown[] }).Ledora = [['consent', false]];
    const h = setup();
    await tick();
    expect(localStorage.getItem('ledora:vid')).toBeNull();
    await tick(10_000);
    expect(h.sent).toHaveLength(0);
  });

  it('pre-init consent(true) then track works in consent mode, tracks before consent are dropped', async () => {
    (window as unknown as { Ledora: unknown[] }).Ledora = [['track', 'too-early'], ['consent', true], ['track', 'ok']];
    const h = setup({ config: siteConfig({ tracking: { consentRequired: true } }) });
    await tick();
    await tick(5000);
    expect(h.events().map((e) => e.name ?? e.type)).toEqual(['pageview', 'ok']);
  });
});

describe('Do Not Track / Global Privacy Control', () => {
  const dnt = (value: string | null, gpc?: boolean) => {
    Object.defineProperty(navigator, 'doNotTrack', { value, configurable: true });
    if (gpc !== undefined) Object.defineProperty(navigator, 'globalPrivacyControl', { value: gpc, configurable: true });
  };
  afterEach(() => {
    delete (navigator as { globalPrivacyControl?: boolean }).globalPrivacyControl;
    delete (navigator as { doNotTrack?: string | null }).doNotTrack;
  });

  it('DNT=1 with respectDoNotTrack: nothing tracked or stored', async () => {
    dnt('1');
    const h = setup({ config: siteConfig({ tracking: { respectDoNotTrack: true } }) });
    await tick();
    Ledora().track('x');
    Ledora().consent(true);
    await tick(10_000);
    expect(h.sent).toHaveLength(0);
    expect(storageKeys()).toEqual([]);
  });

  it('GPC with respectDoNotTrack: nothing tracked', async () => {
    dnt(null, true);
    const h = setup({ config: siteConfig({ tracking: { respectDoNotTrack: true } }) });
    await tick(10_000);
    expect(h.sent).toHaveLength(0);
  });

  it('DNT ignored when respectDoNotTrack is false', async () => {
    dnt('1', true);
    const h = setup({ config: siteConfig({ tracking: { respectDoNotTrack: false } }) });
    await tick();
    await tick(5000);
    expect(h.events()).toHaveLength(1);
  });
});

describe('privacy of collected data', () => {
  it('drops non-utm query params and the hash from URLs and the referrer query', async () => {
    history.replaceState(null, '', '/checkout?email=a%40b.com&utm_source=news&token=secret#step2');
    vi.spyOn(document, 'referrer', 'get').mockReturnValue('https://google.com/search?q=private');
    const h = setup();
    await tick();
    await tick(5000);
    const pv = h.events()[0]!;
    expect(pv.url).toBe('https://shop.example.com/checkout?utm_source=news');
    expect(pv.referrer).toBe('https://google.com/search');
    expect(JSON.stringify(h.sent[0]!.batch)).not.toMatch(/a%40b|a@b|secret|private/);
  });

  it('never reads document.cookie', async () => {
    const cookie = vi.spyOn(document, 'cookie', 'get');
    setup();
    await tick();
    Ledora().track('x', { a: 1 });
    await tick(5000);
    expect(cookie).not.toHaveBeenCalled();
  });
});
