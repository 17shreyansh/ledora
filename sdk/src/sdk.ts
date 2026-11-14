import { INGEST_SCHEMA_VERSION, SITE_KEY_PATTERN } from './core/contract';
import type { IngestEvent } from './core/contract';
import { configKey, fetchConfig, normalizeConfig, readCachedConfig, writeCachedConfig } from './core/config';
import type { SiteConfig } from './core/config';
import { createIds, uuid } from './core/ids';
import { createQueue } from './core/queue';
import type { Queue } from './core/queue';
import { createStore } from './core/storage';
import { later, now, safe, warn } from './core/util';
import type { Timer } from './core/util';
import { isAutomated, isBotUserAgent, privacySignal } from './tracking/bots';
import { cleanName, cleanProps, language, pageUrl, referrer, screenSize } from './tracking/events';
import { patchHistory } from './tracking/history';

export const VERSION: string = __LEDORA_VERSION__;
export const DEFAULT_API = 'https://api.ledora.com/public/v1';
export const CONFIG_RETRY_MS = 30_000;
const PAGEVIEW_DEDUPE_MS = 1000;
const MAX_PENDING = 100;

/** The complete public surface on window.Ledora. */
export interface LedoraApi {
  readonly version: string;
  track(name: string, props?: Record<string, string | number | boolean | null>): void;
  consent(granted: boolean): void;
  push(command: unknown): void;
}

/** Internal handle (tests / future widgets); never exposed on window. */
export interface Handle {
  destroy(): void;
}

type Win = { Ledora?: unknown };
type Command = unknown[];

function apiBase(attr: string | null): string {
  if (attr) {
    try {
      const u = new URL(attr, location.href);
      if (u.protocol === 'https:' || u.protocol === 'http:') return u.href.replace(/\/+$/, '');
    } catch {
      // fall through
    }
    warn('Ignoring invalid data-ledora-api "' + attr + '".');
  }
  return DEFAULT_API;
}

/**
 * Entry point. Synchronous part is tiny (read attributes, install window.Ledora);
 * everything else runs on a later tick. Never throws.
 */
export function start(current: Element | null): Handle | undefined {
  try {
    return init(current);
  } catch {
    return undefined;
  }
}

function init(current: Element | null): Handle | undefined {
  const w = window as unknown as Win;
  const existing = w.Ledora;
  // Already initialised by an earlier copy of the script (or the name is taken): no-op.
  if (existing != null && !Array.isArray(existing)) return undefined;

  const el =
    current && current.hasAttribute('data-ledora-site') ? current : document.querySelector('script[data-ledora-site]');
  const siteKey = ((el && el.getAttribute('data-ledora-site')) || '').trim();
  if (!el || !SITE_KEY_PATTERN.test(siteKey)) {
    warn(
      'Missing or invalid site key' +
        (siteKey ? ' "' + siteKey + '"' : '') +
        '. Add data-ledora-site="ldr_…" (from your Ledora dashboard) to the script tag. Tracking is disabled.',
    );
    return undefined;
  }
  const api = apiBase(el.getAttribute('data-ledora-api'));
  const forceConsent = el.getAttribute('data-ledora-consent') === 'required';
  const hashRouting = el.getAttribute('data-ledora-hash') === 'true';

  const local = createStore('localStorage');
  const session = createStore('sessionStorage');
  const ids = createIds(local);

  // 0 = loading config, 1 = ready, 2 = off for this page load
  let phase: 0 | 1 | 2 = 0;
  let config: SiteConfig | null = null;
  let rawConfig: unknown = null;
  let consent: boolean | null = null;
  let active = false;
  let queue: Queue | null = null;
  let pending: Command[] = Array.isArray(existing) ? existing.slice(0, MAX_PENDING) : [];
  let currentUrl: string | null = null;
  let lastPv = { url: '', at: 0 };
  let sentReferrer = false;
  let navTimer: Timer | undefined;
  const timers: Timer[] = [];
  const cleanup: Array<() => void> = [];

  const clearStorage = (): void => {
    ids.clear();
    session.remove(configKey(siteKey));
  };

  const consentMode = (): boolean => forceConsent || (config ? config.consentRequired : true);
  const allowed = (): boolean => (consentMode() ? consent === true : consent !== false);

  function enqueue(e: Omit<IngestEvent, 'id' | 'ts' | 'visitorId' | 'sessionId'>): void {
    if (!active || !queue || queue.stopped) return;
    const ts = now();
    const { visitorId, sessionId } = ids.touch(ts);
    queue.push({ id: uuid(), ts, visitorId, sessionId, ...e } as IngestEvent);
  }

  function pageview(): void {
    const url = pageUrl(hashRouting);
    if (!url) return;
    currentUrl = url;
    const t = now();
    if (url === lastPv.url && t - lastPv.at < PAGEVIEW_DEDUPE_MS) return;
    lastPv = { url, at: t };
    const e: Omit<IngestEvent, 'id' | 'ts' | 'visitorId' | 'sessionId'> = { type: 'pageview', url };
    if (!sentReferrer) {
      sentReferrer = true;
      const r = referrer();
      if (r) e.referrer = r;
    }
    const s = screenSize();
    if (s) e.screen = s;
    const lang = language();
    if (lang) e.lang = lang;
    enqueue(e);
  }

  /** Coalesces navigation signals; reports only when the reported URL actually changed. */
  function onNavigate(): void {
    if (!active || navTimer !== undefined) return;
    navTimer = later(() => {
      navTimer = undefined;
      if (active && pageUrl(hashRouting) !== currentUrl) pageview();
    }, 0);
  }

  function track(name: unknown, props: unknown): void {
    if (!active) return;
    const n = cleanName(name);
    const p = cleanProps(props);
    if (!n || p === null) {
      warn(
        'Dropped invalid event ' +
          (typeof name === 'string' ? '"' + name.slice(0, 80) + '"' : '') +
          ': names use letters, digits, space, _ . : / - (≤64 chars); props must be an object of ≤20 ' +
          'string/number/boolean/null values with keys matching [A-Za-z0-9_.-] (≤40 chars).',
      );
      return;
    }
    const url = pageUrl(hashRouting);
    if (!url) return;
    const e: Omit<IngestEvent, 'id' | 'ts' | 'visitorId' | 'sessionId'> = { type: 'event', name: n, url };
    if (p) e.props = p;
    enqueue(e);
  }

  function activate(): void {
    if (active || phase !== 1 || !config) return;
    active = true;
    writeCachedConfig(session, siteKey, rawConfig, now());
    pageview();
  }

  function setConsent(granted: boolean): void {
    consent = granted;
    if (!granted) {
      active = false;
      if (queue) queue.clear();
      clearStorage();
      lastPv = { url: '', at: 0 };
    } else if (phase === 1 && allowed()) activate();
  }

  function run(cmd: Command): void {
    const method = cmd[0];
    if (method === 'track') track(cmd[1], cmd[2]);
    else if (method === 'consent') setConsent(cmd[1] === true);
  }

  function command(cmd: Command): void {
    if (cmd[0] === 'consent' && cmd[1] !== true) clearStorage(); // withdraw immediately, even while loading
    if (phase === 0) {
      if (pending.length < MAX_PENDING) pending.push(cmd);
    } else if (phase === 1) run(cmd);
  }

  function ready(cfg: SiteConfig, raw: unknown): void {
    config = cfg;
    rawConfig = raw;
    const queued = pending;
    pending = [];
    if (!cfg.enabled || (cfg.respectDoNotTrack && privacySignal())) {
      phase = 2;
      return;
    }
    phase = 1;
    const automated = isAutomated();
    queue = createQueue({
      endpoint: api + '/collect',
      maxBatchSize: cfg.maxBatchSize,
      flushIntervalMs: cfg.flushIntervalMs,
      header: () => {
        const h: { v: number; siteKey: string; sdkVersion: string; automated?: boolean } = {
          v: INGEST_SCHEMA_VERSION,
          siteKey,
          sdkVersion: VERSION,
        };
        if (automated) h.automated = true;
        return h;
      },
    });

    const on = (target: EventTarget, type: string, fn: () => void): void => {
      const h = safe(fn);
      target.addEventListener(type, h);
      cleanup.push(() => target.removeEventListener(type, h));
    };
    const hide = (): void => {
      if (active && queue) queue.flushBeacon();
    };
    on(window, 'popstate', onNavigate);
    if (hashRouting) on(window, 'hashchange', onNavigate);
    on(window, 'pagehide', hide);
    on(document, 'visibilitychange', () => {
      if (document.visibilityState === 'hidden') hide();
    });
    cleanup.push(
      patchHistory((method, pathChanged) => {
        if (method === 'pushState' || pathChanged) onNavigate();
      }),
    );

    if (allowed()) activate();
    queued.forEach((c) => {
      try {
        if (Array.isArray(c)) run(c);
      } catch {
        // skip a bad command
      }
    });
  }

  function load(attempt: number): void {
    void fetchConfig(api, siteKey).then(
      safe((res) => {
        if (phase !== 0) return;
        const cfg = res && res.status === 200 ? normalizeConfig(res.raw) : null;
        if (cfg) return ready(cfg, res && res.raw);
        if (res && res.status === 404 && attempt === 0) warn('Unknown or disabled site key "' + siteKey + '".');
        if (attempt === 0) timers.push(later(() => load(1), CONFIG_RETRY_MS));
        else {
          phase = 2; // fail closed for this page load
          pending = [];
        }
      }),
    );
  }

  function boot(): void {
    if (phase !== 0) return;
    let ua = '';
    try {
      ua = navigator.userAgent || '';
    } catch {
      // ignore
    }
    if (isBotUserAgent(ua)) {
      phase = 2;
      pending = [];
      return;
    }
    const raw = readCachedConfig(session, siteKey, now());
    const cached = normalizeConfig(raw);
    if (cached) ready(cached, raw);
    else load(0);
  }

  const api$: LedoraApi = Object.freeze({
    version: VERSION,
    track: (name: string, props?: Record<string, string | number | boolean | null>) => {
      try {
        command(['track', name, props]);
      } catch {
        // never throw into the host page
      }
    },
    consent: (granted: boolean) => {
      try {
        command(['consent', granted]);
      } catch {
        // never throw into the host page
      }
    },
    push: (cmd: unknown) => {
      try {
        if (Array.isArray(cmd)) command(cmd);
      } catch {
        // never throw into the host page
      }
    },
  });
  w.Ledora = api$;
  timers.push(later(boot, 0));

  return {
    destroy() {
      phase = 2;
      active = false;
      if (queue) queue.stop();
      timers.forEach((t) => clearTimeout(t));
      if (navTimer !== undefined) clearTimeout(navTimer);
      cleanup.forEach((f) => f());
      if (w.Ledora === api$) delete w.Ledora;
    },
  };
}
