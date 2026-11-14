import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { processWithReceipt } from '../src/modules/events/consumers.js';
import { onboardingNotificationsConsumer } from '../src/modules/events/onboardingNotifications.consumer.js';
import { OutboxModel } from '../src/modules/events/outbox.model.js';
import { toEnvelope } from '../src/modules/events/relay.js';
import { AnalyticsEventModel } from '../src/modules/ingest/analyticsEvent.model.js';
import { createOrg, setPlan, setupTestEnv, signUp, type Client, type TestEnv } from './helpers.js';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const ORIGIN = 'https://shop.example.com';

let env: TestEnv;
let owner: { client: Client; email: string };
let orgId: string;
let site: { id: string; siteKey: string };

beforeAll(async () => {
  env = await setupTestEnv();
  owner = await signUp(env);
  orgId = (await createOrg(owner.client, 'Ingest Co')).id;
  site = (await owner.client.post(`/orgs/${orgId}/websites`, { name: 'Shop', domain: 'shop.example.com' })).body;
});
afterAll(async () => env.teardown());
beforeEach(async () => {
  // Installation activity is throttled per minute in Redis; reset between tests.
  for (const k of await env.redis.keys('site-seen:*')) await env.redis.del(k);
});

function event(over: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    type: 'pageview',
    ts: Date.now(),
    url: 'https://shop.example.com/products/shoes?utm_source=newsletter&utm_campaign=fall&email=jane@example.com#top',
    referrer: 'https://www.google.com/search?q=shoes',
    visitorId: 'v-11111111',
    sessionId: 's-22222222',
    screen: { w: 1440, h: 900 },
    lang: 'en-US',
    ...over,
  };
}

function collect(body: unknown, opts: { origin?: string | null; ua?: string } = {}) {
  let req = request(env.app).post('/public/v1/collect').set('Content-Type', 'text/plain;charset=UTF-8').set('User-Agent', opts.ua ?? UA);
  if (opts.origin !== null) req = req.set('Origin', opts.origin ?? ORIGIN);
  return req.send(typeof body === 'string' ? body : JSON.stringify(body));
}

const batch = (events: unknown[], over: Record<string, unknown> = {}) => ({ v: 1, siteKey: site.siteKey, sdkVersion: '1.0.0', events, ...over });

describe('public config', () => {
  it('serves non-sensitive config with open CORS and no cookies', async () => {
    const res = await request(env.app).get(`/public/v1/sites/${site.siteKey}/config`).set('Origin', 'https://anything.example');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      schemaVersion: 1,
      tracking: { enabled: true, consentRequired: false, respectDoNotTrack: true },
      flushIntervalMs: 5000,
      maxBatchSize: 10,
    });
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    expect(res.headers['set-cookie']).toBeUndefined();
    expect(res.headers['access-control-expose-headers']).toContain('Retry-After');
    expect(JSON.stringify(res.body)).not.toContain(orgId);
  });

  it('404s for unknown or malformed keys', async () => {
    expect((await request(env.app).get('/public/v1/sites/ldr_AAAAAAAAAAAAAAAAAAAA/config')).status).toBe(404);
    expect((await request(env.app).get('/public/v1/sites/not-a-key/config')).status).toBe(404);
  });
});

describe('the site key is not a credential', () => {
  it('cannot reach any private API', async () => {
    for (const path of [`/api/v1/orgs/${orgId}`, `/api/v1/orgs/${orgId}/websites`, `/api/v1/orgs/${orgId}/members`, '/api/v1/me']) {
      const res = await request(env.app).get(path).set('Authorization', `Bearer ${site.siteKey}`).query({ siteKey: site.siteKey });
      expect(res.status).toBe(401);
    }
  });
});

describe('collect', () => {
  it('stores valid events without personal data', async () => {
    const e = event();
    const res = await collect(batch([e]));
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ accepted: 1, duplicates: 0, rejected: 0 });
    const stored = await AnalyticsEventModel.findOne({ eventId: e.id }).lean();
    expect(stored).toMatchObject({
      host: 'shop.example.com',
      path: '/products/shoes',
      utm: { source: 'newsletter', campaign: 'fall' },
      referrerHost: 'www.google.com',
      referrerPath: '/search',
      device: { type: 'desktop', browser: 'Chrome', os: 'macOS' },
    });
    const json = JSON.stringify(stored);
    expect(json).not.toContain('jane@example.com');
    expect(json).not.toContain('q=shoes');
    expect(json).not.toContain('Mozilla');
  });

  it('rejects other origins and missing origins', async () => {
    expect((await collect(batch([event()]), { origin: 'https://evil.example' })).status).toBe(403);
    expect((await collect(batch([event()]), { origin: 'https://shop.example.com.evil.net' })).status).toBe(403);
    expect((await collect(batch([event()]), { origin: null })).status).toBe(403);
  });

  it('drops events whose page URL is on a non-allowed domain', async () => {
    const res = await collect(batch([event({ url: 'https://other.example.org/' }), event()]));
    expect(res.body).toEqual({ accepted: 1, duplicates: 0, rejected: 1 });
  });

  it('validates the batch and each event independently', async () => {
    expect((await collect('{not json')).status).toBe(400);
    expect((await collect(batch([event()], { v: 2 }))).status).toBe(400);
    expect((await collect(batch([]))).status).toBe(400);
    expect((await collect(batch(Array.from({ length: 26 }, () => event())))).status).toBe(400);
    expect((await collect(batch([event()], { siteKey: 'ldr_AAAAAAAAAAAAAAAAAAAA' }))).status).toBe(403);
    const mixed = await collect(
      batch([
        event(),
        event({ type: 'event' }), // custom event without a name
        event({ url: 'javascript:alert(1)' }),
        event({ props: { nested: { a: 1 } } }),
        event({ ts: Date.now() - 2 * 86_400_000 }), // too old
        event({ id: 'x' }),
      ]),
    );
    expect(mixed.status).toBe(202);
    expect(mixed.body).toEqual({ accepted: 1, duplicates: 0, rejected: 5 });
  });

  it('rejects oversized bodies', async () => {
    const res = await collect(batch([event({ props: { blob: 'x'.repeat(200) } })]).toString() + ' '.repeat(40_000));
    expect(res.status).toBe(413);
  });

  it('de-duplicates retried events by id', async () => {
    const e = event();
    expect((await collect(batch([e]))).body.accepted).toBe(1);
    const retry = await collect(batch([e, event()]));
    expect(retry.body).toEqual({ accepted: 1, duplicates: 1, rejected: 0 });
    expect(await AnalyticsEventModel.countDocuments({ eventId: e.id })).toBe(1);
  });

  it('clamps future timestamps to the allowed skew', async () => {
    const e = event({ ts: Date.now() + 86_400_000 });
    await collect(batch([e]));
    const stored = await AnalyticsEventModel.findOne({ eventId: e.id }).lean();
    expect(stored!.ts.getTime()).toBeLessThanOrEqual(Date.now() + 5 * 60_000 + 1000);
  });

  it('filters bots and automation without storing anything', async () => {
    const a = event();
    const b = event();
    expect((await collect(batch([a]), { ua: 'Googlebot/2.1 (+http://www.google.com/bot.html)' })).body).toEqual({ accepted: 0, duplicates: 0, rejected: 1 });
    expect((await collect(batch([b], { automated: true }))).body.accepted).toBe(0);
    expect(await AnalyticsEventModel.countDocuments({ eventId: { $in: [a.id, b.id] } })).toBe(0);
  });

  it('stops a deleted website and a rotated key', async () => {
    const other = (await owner.client.post(`/orgs/${orgId}/websites`, { name: 'Tmp', domain: 'tmp.example.com' }));
    // Free plan allows 1 website, so give this org room first.
    if (other.status === 403) await setPlan(orgId, 'starter');
    const tmp = (await owner.client.post(`/orgs/${orgId}/websites`, { name: 'Tmp', domain: 'tmp.example.com' })).body;
    const send = (key: string) => collect({ v: 1, siteKey: key, sdkVersion: '1.0.0', events: [event({ url: 'https://tmp.example.com/' })] }, { origin: 'https://tmp.example.com' });
    expect((await send(tmp.siteKey)).status).toBe(202);
    const rotated = (await owner.client.post(`/orgs/${orgId}/websites/${tmp.id}/rotate-key`)).body;
    expect((await send(tmp.siteKey)).status).toBe(403);
    expect((await send(rotated.siteKey)).status).toBe(202);
    await owner.client.delete(`/orgs/${orgId}/websites/${tmp.id}`, { confirmName: 'Tmp' });
    expect((await send(rotated.siteKey)).status).toBe(403);
  });
});

describe('installation verification', () => {
  it('verifies on the first real event, emits one outbox event, and emails owners once', async () => {
    const { client, email } = await signUp(env);
    const org = await createOrg(client, 'Verify Co');
    const s = (await client.post(`/orgs/${org.id}/websites`, { name: 'Landing', domain: 'landing.example.com' })).body;
    const send = () =>
      collect({ v: 1, siteKey: s.siteKey, sdkVersion: '1.2.3', events: [event({ url: 'https://landing.example.com/' })] }, { origin: 'https://landing.example.com' });

    expect((await send()).status).toBe(202);
    const verified = (await client.get(`/orgs/${org.id}/websites/${s.id}`)).body;
    expect(verified.installation).toMatchObject({ status: 'verified', sdkVersion: '1.2.3' });
    expect(verified.installation.firstSeenAt).toBeTruthy();

    for (const k of await env.redis.keys('site-seen:*')) await env.redis.del(k);
    await send();
    const rows = await OutboxModel.find({ type: 'website.installation_verified', websiteId: s.id }).lean();
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows[0]!.data)).not.toContain('@');

    const stats = (await client.get(`/orgs/${org.id}/websites/${s.id}/stats`)).body;
    expect(stats).toMatchObject({ eventsLast24h: 2, pageviewsLast24h: 2 });

    // Consumer: sends once even if the event is delivered twice.
    env.mail.clear();
    const consumer = onboardingNotificationsConsumer(env.config, env.mail);
    const envelope = toEnvelope(rows[0]!);
    expect(await processWithReceipt(consumer, envelope)).toBe('processed');
    expect(await processWithReceipt(consumer, envelope)).toBe('duplicate');
    expect(env.mail.sent.filter((m) => m.template === 'installation_verified')).toHaveLength(1);
    expect(env.mail.last(email)?.template).toBe('installation_verified');
  });
});

describe('monthly quota', () => {
  it('stops accepting events at the plan quota and reports usage', async () => {
    const { client } = await signUp(env);
    const org = await createOrg(client, 'Quota Co');
    await setPlan(org.id, 'free', { monthlyEvents: 3 });
    const s = (await client.post(`/orgs/${org.id}/websites`, { name: 'Q', domain: 'q.example.com' })).body;
    const send = (n: number) =>
      collect({ v: 1, siteKey: s.siteKey, sdkVersion: '1.0.0', events: Array.from({ length: n }, () => event({ url: 'https://q.example.com/' })) }, { origin: 'https://q.example.com' });
    expect((await send(2)).body).toEqual({ accepted: 2, duplicates: 0, rejected: 0 });
    expect((await send(2)).body).toEqual({ accepted: 1, duplicates: 0, rejected: 1 });
    const blocked = await send(1);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('QUOTA_EXCEEDED');
    expect((await client.get(`/orgs/${org.id}/usage`)).body.usage.monthlyEvents).toBe(3);
  });
});
