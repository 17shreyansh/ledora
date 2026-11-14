import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { Types } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AnalyticsService } from '../src/modules/analytics/analytics.service.js';
import { AnalyticsEventModel, type AnalyticsEvent } from '../src/modules/ingest/analyticsEvent.model.js';
import { foldIntoSessions } from '../src/modules/ingest/rollup.js';
import { AnalyticsSessionModel } from '../src/modules/ingest/sessionVisitor.models.js';
import { OrganizationModel, type Organization } from '../src/modules/organizations/organization.model.js';
import { addMember, createOrg, setPlan, setupTestEnv, signUp, type Client, type TestEnv } from './helpers.js';

const TZ = 'Asia/Kolkata';
// 2026-11-14 12:45 IST
const NOW = Date.parse('2026-11-14T07:15:00Z');
const svc = new AnalyticsService();

let env: TestEnv;
let owner: { client: Client; email: string };
let org: Organization;
let siteA: { id: string; siteKey: string };
let siteB: { id: string; siteKey: string };

type Ev = Partial<Omit<AnalyticsEvent, 'ts'>> & { ts: string; visitorId: string; sessionId: string; site?: string };
async function store(list: Ev[]) {
  const docs = list.map((e) => ({
    orgId: org._id,
    websiteId: new Types.ObjectId(e.site ?? siteA.id),
    eventId: randomUUID(),
    type: e.type ?? 'pageview',
    name: e.name ?? null,
    ts: new Date(e.ts),
    receivedAt: new Date(e.ts),
    visitorId: e.visitorId,
    sessionId: e.sessionId,
    host: 'a.example.com',
    path: e.path ?? '/',
    utm: e.utm ?? null,
    referrerHost: e.referrerHost ?? null,
    referrerPath: null,
    device: e.device ?? { type: 'desktop', browser: 'Chrome', os: 'macOS' },
    screen: null,
    lang: null,
    props: null,
    sdkVersion: '1.0.0',
    expiresAt: new Date(Date.parse(e.ts) + 90 * 86_400_000),
  }));
  await AnalyticsEventModel.insertMany(docs);
  await foldIntoSessions(docs);
}

beforeAll(async () => {
  env = await setupTestEnv();
  owner = await signUp(env);
  const o = await createOrg(owner.client, 'Analytics Co');
  await owner.client.patch(`/orgs/${o.id}`, { timezone: TZ });
  await setPlan(o.id, 'starter');
  org = (await OrganizationModel.findById(o.id).lean<Organization>())!;
  siteA = (await owner.client.post(`/orgs/${o.id}/websites`, { name: 'A', domain: 'a.example.com' })).body;
  siteB = (await owner.client.post(`/orgs/${o.id}/websites`, { name: 'B', domain: 'b.example.com' })).body;

  const seed: Ev[] = [
    // Seen before the range (Nov 1) → not a new visitor in the 7-day range.
    { ts: '2026-11-01T10:00:00Z', visitorId: 'v-old', sessionId: 's-old0' },
    // Session 1 (v-old): 3 pageviews over 2 minutes, google referral, entry /, exit /pricing.
    { ts: '2026-11-13T19:00:00Z', visitorId: 'v-old', sessionId: 's-1', path: '/', referrerHost: 'www.google.com' }, // 00:30 IST Nov 14
    { ts: '2026-11-13T19:01:00Z', visitorId: 'v-old', sessionId: 's-1', path: '/features' },
    { ts: '2026-11-13T19:02:00Z', visitorId: 'v-old', sessionId: 's-1', path: '/pricing' },
    // Session 2 (v-new): bounce, newsletter campaign, mobile.
    { ts: '2026-11-13T18:00:00Z', visitorId: 'v-new', sessionId: 's-2', path: '/blog', utm: { source: 'newsletter', campaign: 'fall' }, device: { type: 'mobile' as const, browser: 'Safari', os: 'iOS' } }, // 23:30 IST Nov 13
    // Session 3 (v-new2): one pageview + a signup event → not a bounce.
    { ts: '2026-11-14T04:00:00Z', visitorId: 'v-new2', sessionId: 's-3', path: '/pricing' },
    { ts: '2026-11-14T04:00:30Z', visitorId: 'v-new2', sessionId: 's-3', path: '/pricing', type: 'event', name: 'signup' },
    // Website B: one pageview.
    { ts: '2026-11-14T05:00:00Z', visitorId: 'v-b', sessionId: 's-b', path: '/b', site: 'B' },
    // Previous period (Nov 1–7): two pageviews by one visitor.
    { ts: '2026-11-05T10:00:00Z', visitorId: 'v-prev', sessionId: 's-p', path: '/' },
    { ts: '2026-11-05T10:05:00Z', visitorId: 'v-prev', sessionId: 's-p', path: '/about' },
  ];
  await store(seed.map((e) => (e.site === 'B' ? { ...e, site: siteB.id } : e)));
});
afterAll(async () => env.teardown());

describe('overview', () => {
  it('computes totals for one website over the last 7 days', async () => {
    const o = await svc.overview(org, { range: '7d', websiteId: siteA.id, compare: true }, NOW);
    expect(o.range).toMatchObject({ fromDate: '2026-11-08', toDate: '2026-11-14', timezone: TZ, granularity: 'day' });
    expect(o.totals).toEqual({
      pageviews: 5,
      visitors: 3,
      sessions: 3,
      newVisitors: 2,
      events: 1,
      bounceRate: 1 / 3,
      avgSessionSeconds: Math.round((120 + 0 + 30) / 3),
      pagesPerSession: 1.67,
    });
    expect(o.previousTotals).toMatchObject({ pageviews: 3, visitors: 2, sessions: 2 });
  });

  it('includes every website when none is selected, and only this org', async () => {
    const all = await svc.overview(org, { range: '7d', compare: false }, NOW);
    expect(all.totals.pageviews).toBe(6);
    expect(all.previousTotals).toBeNull();
  });

  it('buckets by local midnight in the org time zone, zero-filled', async () => {
    const o = await svc.overview(org, { range: '7d', websiteId: siteA.id, compare: false }, NOW);
    expect(o.series).toHaveLength(7);
    expect(o.series[0]!.t).toBe('2026-11-07T18:30:00.000Z'); // Nov 8 00:00 IST
    const nov13 = o.series[5]!;
    const nov14 = o.series[6]!;
    // 23:30 IST belongs to Nov 13; 00:30 IST to Nov 14, although both are Nov 13 in UTC.
    expect(nov13).toMatchObject({ t: '2026-11-12T18:30:00.000Z', pageviews: 1, visitors: 1, sessions: 1 });
    expect(nov14).toMatchObject({ pageviews: 4, visitors: 2, sessions: 2 });
    expect(o.series.slice(0, 5).every((p) => p.pageviews === 0)).toBe(true);
  });

  it('uses hourly buckets for today', async () => {
    const o = await svc.overview(org, { range: 'today', websiteId: siteA.id, compare: false }, NOW);
    expect(o.series).toHaveLength(13);
    expect(o.series[0]!).toMatchObject({ t: '2026-11-13T18:30:00.000Z', pageviews: 3 }); // 00:00–01:00 IST
    expect(o.series[9]!).toMatchObject({ t: '2026-11-14T03:30:00.000Z', pageviews: 1 }); // 09:00 IST (04:00Z)
  });
});

describe('breakdowns', () => {
  const q = { range: '7d' as const, limit: 10 };
  it('ranks pages by pageviews with unique visitors and a total', async () => {
    const b = await svc.breakdown(org, { ...q, websiteId: siteA.id, dimension: 'page' }, NOW);
    expect(b.valueLabel).toBe('pageviews');
    expect(b.rows[0]).toEqual({ key: '/pricing', value: 2, visitors: 2 });
    expect(b.total).toBe(5);
  });

  it('labels direct traffic and missing campaigns, and counts sessions', async () => {
    const ref = await svc.breakdown(org, { ...q, websiteId: siteA.id, dimension: 'referrer' }, NOW);
    expect(ref.rows).toEqual([
      { key: '(direct)', value: 2, visitors: 2 },
      { key: 'www.google.com', value: 1, visitors: 1 },
    ]);
    const src = await svc.breakdown(org, { ...q, websiteId: siteA.id, dimension: 'utm_source' }, NOW);
    expect(src.rows.map((r) => r.key)).toEqual(['(none)', 'newsletter']);
  });

  it('reports entry and exit pages, devices and custom events', async () => {
    const entry = await svc.breakdown(org, { ...q, websiteId: siteA.id, dimension: 'entry_page' }, NOW);
    expect(entry.rows.map((r) => r.key).sort()).toEqual(['/', '/blog', '/pricing']);
    const exit = await svc.breakdown(org, { ...q, websiteId: siteA.id, dimension: 'exit_page' }, NOW);
    expect(exit.rows.find((r) => r.key === '/pricing')?.value).toBe(2);
    const dev = await svc.breakdown(org, { ...q, websiteId: siteA.id, dimension: 'device' }, NOW);
    expect(dev.rows).toEqual([{ key: 'desktop', value: 2, visitors: 2 }, { key: 'mobile', value: 1, visitors: 1 }]);
    const ev = await svc.breakdown(org, { ...q, websiteId: siteA.id, dimension: 'event' }, NOW);
    expect(ev).toMatchObject({ valueLabel: 'events', rows: [{ key: 'signup', value: 1, visitors: 1 }], total: 1 });
  });

  it('honours the limit but keeps the full total', async () => {
    const b = await svc.breakdown(org, { ...q, limit: 1, websiteId: siteA.id, dimension: 'page' }, NOW);
    expect(b.rows).toHaveLength(1);
    expect(b.total).toBe(5);
  });
});

describe('realtime', () => {
  it('counts active visitors and lists recent events without visitor ids', async () => {
    const rt = await svc.realtime(org, siteA.id, Date.parse('2026-11-14T04:03:00Z'));
    expect(rt.activeVisitors).toBe(1);
    expect(rt.perMinute).toHaveLength(30);
    expect(rt.perMinute.reduce((a, p) => a + p.pageviews, 0)).toBe(1);
    expect(rt.topPages).toEqual([{ path: '/pricing', visitors: 1 }]);
    expect(rt.recent[0]).toMatchObject({ type: 'event', name: 'signup', path: '/pricing', websiteName: 'A' });
    expect(JSON.stringify(rt)).not.toContain('v-new2');
  });
});

describe('API', () => {
  it('serves analytics to every role, validates input, and hides other tenants', async () => {
    const viewer = await signUp(env);
    await addMember(env, owner.client, org._id.toHexString(), viewer, 'viewer');
    const id = org._id.toHexString();
    for (const path of ['overview', 'breakdown?dimension=page', 'realtime']) {
      expect((await viewer.client.get(`/orgs/${id}/analytics/${path}`)).status).toBe(200);
    }
    expect((await owner.client.get(`/orgs/${id}/analytics/overview?range=custom&from=2024-01-01&to=2026-11-01`)).status).toBe(400);
    expect((await owner.client.get(`/orgs/${id}/analytics/overview?range=custom`)).status).toBe(400);
    expect((await owner.client.get(`/orgs/${id}/analytics/breakdown?dimension=password`)).status).toBe(400);

    const other = await signUp(env);
    const otherOrg = await createOrg(other.client, 'Other Co');
    expect((await other.client.get(`/orgs/${id}/analytics/overview`)).status).toBe(404);
    // Another org's website id through the attacker's own org.
    expect((await other.client.get(`/orgs/${otherOrg.id}/analytics/overview?websiteId=${siteA.id}`)).status).toBe(404);
    const theirs = await other.client.get(`/orgs/${otherOrg.id}/analytics/overview?range=90d`);
    expect(theirs.body.totals.pageviews).toBe(0);
  });
});

describe('collection feeds sessions correctly', () => {
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
  const send = (events: object[]) =>
    request(env.app)
      .post('/public/v1/collect')
      .set('Content-Type', 'text/plain')
      .set('Origin', 'https://b.example.com')
      .set('User-Agent', UA)
      .send(JSON.stringify({ v: 1, siteKey: siteB.siteKey, sdkVersion: '1.0.0', events }));
  const ev = (over: object) => ({ id: randomUUID(), type: 'pageview', ts: Date.now(), url: 'https://b.example.com/', visitorId: 'v-live-0001', sessionId: 's-live-0001', ...over });

  it('does not double count retried events and fixes entry/exit for out-of-order batches', async () => {
    const t = Date.now();
    const late = ev({ ts: t, url: 'https://b.example.com/checkout' });
    const first = await send([late]);
    expect(first.body, JSON.stringify(first.body)).toMatchObject({ accepted: 1 });
    expect((await send([late])).body.duplicates).toBe(1); // retry
    // An earlier event arrives afterwards (out of order).
    expect((await send([ev({ ts: t - 60_000, url: 'https://b.example.com/landing' })])).body.accepted).toBe(1);
    const s = await AnalyticsSessionModel.findOne({ sessionId: 's-live-0001' }).lean();
    expect(s).toMatchObject({ pageviews: 2, entryPath: '/landing', exitPath: '/checkout' });
    expect(s!.endedAt.getTime() - s!.startedAt.getTime()).toBe(60_000);
  });

  it('keeps hash routes and treats "$"-prefixed values as data', async () => {
    await send([ev({ sessionId: 's-live-0002', url: 'https://b.example.com/app/#/settings?tab=1&email=a@b.co' })]);
    await send([ev({ sessionId: 's-live-0003', url: 'https://b.example.com/?utm_source=$where&utm_campaign=$gt' })]);
    expect(await AnalyticsEventModel.exists({ path: '/app#/settings' })).toBeTruthy();
    const s3 = await AnalyticsSessionModel.findOne({ sessionId: 's-live-0003' }).lean();
    expect(s3?.utm).toEqual({ source: '$where', campaign: '$gt' });
    expect(await AnalyticsEventModel.exists({ path: { $regex: 'email' } })).toBeNull();
  });
});
