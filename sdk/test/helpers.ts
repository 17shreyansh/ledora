import { vi } from 'vitest';
import type { IngestBatch, PublicSiteConfig } from '../src/core/contract';
import { start } from '../src/sdk';
import type { Handle } from '../src/sdk';

export const SITE_KEY = 'ldr_abcdefghijklmnopqrst';
export const API = 'https://api.test/public/v1';
export const COLLECT = API + '/collect';
export const CONFIG_URL = `${API}/sites/${SITE_KEY}/config`;

type ConfigOverrides = Partial<Omit<PublicSiteConfig, 'tracking'>> & { tracking?: Partial<PublicSiteConfig['tracking']> };

export function siteConfig(over: ConfigOverrides = {}): PublicSiteConfig {
  return {
    schemaVersion: 1,
    flushIntervalMs: 5000,
    maxBatchSize: 10,
    ...over,
    tracking: { enabled: true, consentRequired: false, respectDoNotTrack: false, ...over.tracking },
  };
}

type CollectReply = number | { status: number; retryAfter?: string } | 'reject';

export interface Sent {
  url: string;
  init: RequestInit;
  batch: IngestBatch;
}

export interface Harness {
  handle: Handle | undefined;
  fetch: ReturnType<typeof vi.fn>;
  /** Every POST /collect made so far, parsed. */
  sent: Sent[];
  events(): IngestBatch['events'];
  configCalls(): number;
}

function response(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    headers: { get: (k: string) => headers[k] ?? headers[k.toLowerCase()] ?? null },
  } as unknown as Response;
}

let current: Harness | undefined;

export interface SetupOptions {
  config?: PublicSiteConfig | 404 | 'reject';
  collect?: (n: number, batch: IngestBatch) => CollectReply;
  attrs?: Record<string, string>;
  siteKey?: string | null;
  /** Do not call start() — the test does it. */
  manual?: boolean;
}

export function makeScript(attrs: Record<string, string>): HTMLScriptElement {
  const s = document.createElement('script');
  for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v);
  document.head.appendChild(s);
  return s;
}

export function setup(o: SetupOptions = {}): Harness {
  const sent: Sent[] = [];
  let configCalls = 0;
  const fetchMock = vi.fn((input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    if (url.endsWith('/config')) {
      configCalls++;
      const c = o.config ?? siteConfig();
      if (c === 'reject') return Promise.reject(new TypeError('Failed to fetch'));
      if (c === 404) return Promise.resolve(response(404, { error: 'not found' }));
      return Promise.resolve(response(200, c));
    }
    const batch = JSON.parse(String(init.body)) as IngestBatch;
    sent.push({ url, init, batch });
    const r = o.collect ? o.collect(sent.length, batch) : 202;
    if (r === 'reject') return Promise.reject(new TypeError('Failed to fetch'));
    const status = typeof r === 'number' ? r : r.status;
    const headers: Record<string, string> = typeof r === 'object' && r.retryAfter ? { 'Retry-After': r.retryAfter } : {};
    return Promise.resolve(response(status, { accepted: batch.events.length, duplicates: 0, rejected: 0 }, headers));
  });
  vi.stubGlobal('fetch', fetchMock);
  const attrs: Record<string, string> = { 'data-ledora-api': API, ...o.attrs };
  if (o.siteKey !== null) attrs['data-ledora-site'] = o.siteKey ?? SITE_KEY;
  const script = makeScript(attrs);
  const h: Harness = {
    handle: o.manual ? undefined : start(script),
    fetch: fetchMock,
    sent,
    events: () => sent.flatMap((s) => s.batch.events),
    configCalls: () => configCalls,
  };
  current = h;
  return h;
}

export function reset(): void {
  current?.handle?.destroy();
  current = undefined;
  delete (window as unknown as { Ledora?: unknown }).Ledora;
  document.head.innerHTML = '';
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    // ignore
  }
  history.replaceState(null, '', '/');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
}

export const Ledora = (): { track: (n: unknown, p?: unknown) => void; consent: (g: boolean) => void; push: (c: unknown) => void; version: string } =>
  (window as unknown as { Ledora: never }).Ledora;

/** Let the boot tick, config promise and any 0ms timers run. */
export const tick = (ms = 0): Promise<void> => vi.advanceTimersByTimeAsync(ms).then(() => undefined);
