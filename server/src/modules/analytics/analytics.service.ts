import type {
  AnalyticsOverviewDto,
  AnalyticsTotals,
  BreakdownDimension,
  BreakdownDto,
  RealtimeDto,
  TimeseriesPoint,
} from '@ledora/shared';
import { Types, type PipelineStage } from 'mongoose';
import { AppError } from '../../common/errors/AppError.js';
import { AnalyticsEventModel } from '../ingest/analyticsEvent.model.js';
import { AnalyticsSessionModel, AnalyticsVisitorModel } from '../ingest/sessionVisitor.models.js';
import type { Organization } from '../organizations/organization.model.js';
import { WebsiteModel, type Website } from '../websites/website.model.js';
import { buckets, resolveRange, toResolved, type Range, type RangeRequest } from './range.js';

/**
 * Read side of analytics. All queries go through here (never from routes), scoped to
 * the organization's own websites, so the storage engine can change later
 * (rollups, ClickHouse) without touching the API.
 */
export class AnalyticsService {
  /** Website ids in scope: one validated website, or every active website of the org. */
  async scope(org: Organization, websiteId?: string): Promise<{ ids: Types.ObjectId[]; names: Map<string, string> }> {
    const filter: Record<string, unknown> = { orgId: org._id, status: 'active' };
    if (websiteId) filter._id = new Types.ObjectId(websiteId);
    const sites = await WebsiteModel.find(filter).select({ name: 1 }).lean<Pick<Website, '_id' | 'name'>[]>();
    if (websiteId && sites.length === 0) throw AppError.notFound('Website not found');
    return { ids: sites.map((s) => s._id), names: new Map(sites.map((s) => [s._id.toHexString(), s.name])) };
  }

  // ── Totals ──

  private async totals(ids: Types.ObjectId[], r: Range): Promise<AnalyticsTotals> {
    const inRange = { websiteId: { $in: ids }, ts: { $gte: new Date(r.start), $lt: new Date(r.end) } };
    const [eventAgg, sessionAgg, newVisitors] = await Promise.all([
      AnalyticsEventModel.aggregate<{ counts: Array<{ pageviews: number; events: number }>; visitors: Array<{ n: number }> }>([
        { $match: inRange },
        {
          $facet: {
            counts: [
              {
                $group: {
                  _id: null,
                  pageviews: { $sum: { $cond: [{ $eq: ['$type', 'pageview'] }, 1, 0] } },
                  events: { $sum: { $cond: [{ $eq: ['$type', 'event'] }, 1, 0] } },
                },
              },
            ],
            visitors: [{ $group: { _id: '$visitorId' } }, { $count: 'n' }],
          },
        },
      ]),
      AnalyticsSessionModel.aggregate<{ sessions: number; bounces: number; duration: number; pageviews: number }>([
        { $match: { websiteId: { $in: ids }, startedAt: { $gte: new Date(r.start), $lt: new Date(r.end) } } },
        {
          $group: {
            _id: null,
            sessions: { $sum: 1 },
            bounces: { $sum: { $cond: [{ $and: [{ $lte: ['$pageviews', 1] }, { $eq: ['$events', 0] }] }, 1, 0] } },
            duration: { $sum: { $subtract: ['$endedAt', '$startedAt'] } },
            pageviews: { $sum: '$pageviews' },
          },
        },
      ]),
      AnalyticsVisitorModel.countDocuments({ websiteId: { $in: ids }, firstSeenAt: { $gte: new Date(r.start), $lt: new Date(r.end) } }),
    ]);
    const c = eventAgg[0]?.counts[0];
    const s = sessionAgg[0];
    const sessions = s?.sessions ?? 0;
    return {
      pageviews: c?.pageviews ?? 0,
      visitors: eventAgg[0]?.visitors[0]?.n ?? 0,
      sessions,
      newVisitors,
      events: c?.events ?? 0,
      bounceRate: sessions ? s!.bounces / sessions : null,
      avgSessionSeconds: sessions ? Math.round(s!.duration / sessions / 1000) : null,
      pagesPerSession: sessions ? Math.round((s!.pageviews / sessions) * 100) / 100 : null,
    };
  }

  // ── Time series ──

  private async series(ids: Types.ObjectId[], r: Range, tz: string): Promise<TimeseriesPoint[]> {
    const bucket = { $dateTrunc: { date: '$ts', unit: r.granularity, timezone: tz } };
    const [ev, ss] = await Promise.all([
      AnalyticsEventModel.aggregate<{ _id: Date; pageviews: number; visitors: number }>([
        { $match: { websiteId: { $in: ids }, ts: { $gte: new Date(r.start), $lt: new Date(r.end) } } },
        { $group: { _id: { b: bucket, v: '$visitorId' }, pv: { $sum: { $cond: [{ $eq: ['$type', 'pageview'] }, 1, 0] } } } },
        { $group: { _id: '$_id.b', pageviews: { $sum: '$pv' }, visitors: { $sum: 1 } } },
      ]),
      AnalyticsSessionModel.aggregate<{ _id: Date; sessions: number }>([
        { $match: { websiteId: { $in: ids }, startedAt: { $gte: new Date(r.start), $lt: new Date(r.end) } } },
        { $group: { _id: { $dateTrunc: { date: '$startedAt', unit: r.granularity, timezone: tz } }, sessions: { $sum: 1 } } },
      ]),
    ]);
    const evBy = new Map(ev.map((x) => [x._id.getTime(), x]));
    const ssBy = new Map(ss.map((x) => [x._id.getTime(), x.sessions]));
    return buckets(r, tz).map((t) => ({
      t: new Date(t).toISOString(),
      pageviews: evBy.get(t)?.pageviews ?? 0,
      visitors: evBy.get(t)?.visitors ?? 0,
      sessions: ssBy.get(t) ?? 0,
    }));
  }

  async overview(org: Organization, q: RangeRequest & { websiteId?: string; compare: boolean }, now = Date.now()): Promise<AnalyticsOverviewDto> {
    const tz = org.timezone || 'UTC';
    const { ids } = await this.scope(org, q.websiteId);
    const { current, previous } = resolveRange(q, tz, now);
    const [totals, series, prevTotals, prevSeries] = await Promise.all([
      this.totals(ids, current),
      this.series(ids, current, tz),
      q.compare ? this.totals(ids, previous) : Promise.resolve(null),
      q.compare ? this.series(ids, previous, tz) : Promise.resolve(null),
    ]);
    return {
      range: toResolved(current, tz),
      previousRange: q.compare ? toResolved(previous, tz) : null,
      totals,
      previousTotals: prevTotals,
      series,
      previousSeries: prevSeries,
    };
  }

  // ── Breakdowns ──

  async breakdown(
    org: Organization,
    q: RangeRequest & { websiteId?: string; dimension: BreakdownDimension; limit: number },
    now = Date.now(),
  ): Promise<BreakdownDto> {
    const tz = org.timezone || 'UTC';
    const { ids } = await this.scope(org, q.websiteId);
    const { current: r } = resolveRange(q, tz, now);
    const start = new Date(r.start);
    const end = new Date(r.end);

    type Spec = { coll: 'events' | 'sessions'; match: Record<string, unknown>; key: unknown; valueLabel: BreakdownDto['valueLabel'] };
    const ev = (extra: Record<string, unknown>, key: unknown, valueLabel: BreakdownDto['valueLabel']): Spec => ({
      coll: 'events',
      match: { websiteId: { $in: ids }, ts: { $gte: start, $lt: end }, ...extra },
      key,
      valueLabel,
    });
    const ss = (key: unknown): Spec => ({
      coll: 'sessions',
      match: { websiteId: { $in: ids }, startedAt: { $gte: start, $lt: end } },
      key,
      valueLabel: 'sessions',
    });
    const specs: Record<BreakdownDimension, Spec> = {
      page: ev({ type: 'pageview' }, '$path', 'pageviews'),
      event: ev({ type: 'event' }, '$name', 'events'),
      entry_page: ss('$entryPath'),
      exit_page: ss('$exitPath'),
      referrer: ss({ $ifNull: ['$referrerHost', '(direct)'] }),
      utm_source: ss({ $ifNull: ['$utm.source', '(none)'] }),
      utm_medium: ss({ $ifNull: ['$utm.medium', '(none)'] }),
      utm_campaign: ss({ $ifNull: ['$utm.campaign', '(none)'] }),
      device: ss({ $ifNull: ['$device.type', '(not set)'] }),
      browser: ss({ $ifNull: ['$device.browser', '(not set)'] }),
      os: ss({ $ifNull: ['$device.os', '(not set)'] }),
    };
    const spec = specs[q.dimension];
    const pipeline: PipelineStage[] = [
      { $match: spec.match },
      { $group: { _id: { k: spec.key, v: '$visitorId' }, n: { $sum: 1 } } },
      { $group: { _id: '$_id.k', value: { $sum: '$n' }, visitors: { $sum: 1 } } },
      {
        $facet: {
          rows: [{ $sort: { value: -1, _id: 1 } }, { $limit: q.limit }],
          total: [{ $group: { _id: null, t: { $sum: '$value' } } }],
        },
      },
    ];
    const model = spec.coll === 'events' ? AnalyticsEventModel : AnalyticsSessionModel;
    const [res] = await (model as typeof AnalyticsEventModel).aggregate<{ rows: Array<{ _id: unknown; value: number; visitors: number }>; total: Array<{ t: number }> }>(pipeline);
    return {
      dimension: q.dimension,
      valueLabel: spec.valueLabel,
      rows: (res?.rows ?? []).map((x) => ({ key: x._id == null || x._id === '' ? '(not set)' : String(x._id), visitors: x.visitors, value: x.value })),
      total: res?.total[0]?.t ?? 0,
    };
  }

  // ── Realtime ──

  async realtime(org: Organization, websiteId?: string, now = Date.now()): Promise<RealtimeDto> {
    const { ids, names } = await this.scope(org, websiteId);
    const minute = 60_000;
    const windowStart = new Date(Math.floor(now / minute) * minute - 29 * minute);
    const fiveMin = new Date(now - 5 * minute);
    const [active, perMin, top, recent] = await Promise.all([
      AnalyticsEventModel.aggregate<{ n: number }>([
        { $match: { websiteId: { $in: ids }, ts: { $gte: fiveMin, $lte: new Date(now) } } },
        { $group: { _id: '$visitorId' } },
        { $count: 'n' },
      ]),
      AnalyticsEventModel.aggregate<{ _id: Date; n: number }>([
        { $match: { websiteId: { $in: ids }, type: 'pageview', ts: { $gte: windowStart, $lte: new Date(now) } } },
        { $group: { _id: { $dateTrunc: { date: '$ts', unit: 'minute' } }, n: { $sum: 1 } } },
      ]),
      AnalyticsEventModel.aggregate<{ _id: string; visitors: number }>([
        { $match: { websiteId: { $in: ids }, type: 'pageview', ts: { $gte: windowStart, $lte: new Date(now) } } },
        { $group: { _id: { p: '$path', v: '$visitorId' } } },
        { $group: { _id: '$_id.p', visitors: { $sum: 1 } } },
        { $sort: { visitors: -1, _id: 1 } },
        { $limit: 10 },
      ]),
      AnalyticsEventModel.find({ websiteId: { $in: ids }, ts: { $lte: new Date(now) } })
        .sort({ ts: -1 })
        .limit(20)
        .select({ ts: 1, type: 1, name: 1, path: 1, websiteId: 1, device: 1 })
        .lean(),
    ]);
    const byMin = new Map(perMin.map((x) => [x._id.getTime(), x.n]));
    return {
      activeVisitors: active[0]?.n ?? 0,
      perMinute: Array.from({ length: 30 }, (_, i) => {
        const t = windowStart.getTime() + i * minute;
        return { t: new Date(t).toISOString(), pageviews: byMin.get(t) ?? 0 };
      }),
      topPages: top.map((x) => ({ path: x._id, visitors: x.visitors })),
      recent: recent.map((e) => ({
        ts: e.ts.toISOString(),
        type: e.type,
        name: e.name,
        path: e.path,
        websiteName: names.get(e.websiteId.toHexString()) ?? '',
        device: e.device.type,
        browser: e.device.browser,
      })),
    };
  }
}
