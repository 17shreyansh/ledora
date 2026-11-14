import {
  hostMatchesPatterns,
  ingestBatchHeaderSchema,
  ingestEventSchema,
  INGEST_LIMITS,
  type IngestResponse,
  type PublicSiteConfig,
} from '@ledora/shared';
import type { Redis } from 'ioredis';
import { Types } from 'mongoose';
import { AppError } from '../../common/errors/AppError.js';
import { logger } from '../../common/logger.js';
import type { EntitlementsService } from '../entitlements/entitlements.service.js';
import { OrganizationModel, type Organization } from '../organizations/organization.model.js';
import { WebsiteModel, type Website } from '../websites/website.model.js';
import type { WebsitesService } from '../websites/websites.service.js';
import { AnalyticsEventModel, type AnalyticsEvent } from './analyticsEvent.model.js';
import { cleanPageUrl, cleanReferrer } from './sanitize.js';
import { classifyUserAgent, isBotUserAgent } from './userAgent.js';

/** The slice of a website the public path needs; cached in Redis for a minute. */
interface SiteSnapshot {
  websiteId: string;
  orgId: string;
  allowedDomains: string[];
  tracking: Website['tracking'];
}

const SITE_CACHE_TTL_S = 60;

export interface IngestRequestMeta {
  origin: string | undefined;
  userAgent: string | undefined;
}

export class IngestService {
  constructor(
    private readonly redis: Redis,
    private readonly entitlements: EntitlementsService,
    private readonly websites: WebsitesService,
  ) {}

  async site(siteKey: string): Promise<SiteSnapshot | null> {
    const cacheKey = `site:${siteKey}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached === 'none' ? null : (JSON.parse(cached) as SiteSnapshot);
    const w = await WebsiteModel.findOne({ siteKey, status: 'active' }).lean<Website>();
    const org = w ? await OrganizationModel.exists({ _id: w.orgId, status: 'active' }) : null;
    const snap: SiteSnapshot | null =
      w && org ? { websiteId: w._id.toHexString(), orgId: w.orgId.toHexString(), allowedDomains: w.allowedDomains, tracking: w.tracking } : null;
    await this.redis.set(cacheKey, snap ? JSON.stringify(snap) : 'none', 'EX', SITE_CACHE_TTL_S);
    return snap;
  }

  async publicConfig(siteKey: string): Promise<PublicSiteConfig> {
    const site = await this.site(siteKey);
    if (!site) throw AppError.notFound('Unknown site key');
    return {
      schemaVersion: 1,
      tracking: { enabled: true, consentRequired: site.tracking.consentRequired, respectDoNotTrack: site.tracking.respectDoNotTrack },
      flushIntervalMs: 5_000,
      maxBatchSize: 10,
    };
  }

  async collect(body: unknown, meta: IngestRequestMeta): Promise<IngestResponse> {
    const header = ingestBatchHeaderSchema.safeParse(body);
    if (!header.success) throw AppError.badRequest('Invalid batch');
    const batch = header.data;

    const site = await this.site(batch.siteKey);
    if (!site) throw AppError.forbidden('Unknown or disabled site key');

    // Origin is a browser-supplied signal, not authentication (non-browser clients can
    // forge it); it stops other websites from casually reusing a site key.
    let originHost: string | null = null;
    try {
      originHost = meta.origin ? new URL(meta.origin).hostname.toLowerCase() : null;
    } catch {
      originHost = null;
    }
    if (!originHost || !hostMatchesPatterns(originHost, site.allowedDomains)) {
      throw AppError.forbidden('This domain is not allowed to send events for this site');
    }

    const total = batch.events.length;
    if (batch.automated || isBotUserAgent(meta.userAgent)) {
      return { accepted: 0, duplicates: 0, rejected: total };
    }

    const now = Date.now();
    const device = classifyUserAgent(meta.userAgent!);
    const orgId = new Types.ObjectId(site.orgId);
    const websiteId = new Types.ObjectId(site.websiteId);
    const valid: Omit<AnalyticsEvent, '_id' | 'expiresAt'>[] = [];
    for (const raw of batch.events) {
      const parsed = ingestEventSchema.safeParse(raw);
      if (!parsed.success) continue;
      const e = parsed.data;
      if (e.ts < now - INGEST_LIMITS.maxEventAgeMs) continue;
      const page = cleanPageUrl(e.url);
      if (!page || !hostMatchesPatterns(page.host, site.allowedDomains)) continue;
      const ref = cleanReferrer(e.referrer, page.host);
      valid.push({
        orgId,
        websiteId,
        eventId: e.id,
        type: e.type,
        name: e.type === 'event' ? (e.name ?? null) : null,
        ts: new Date(Math.min(e.ts, now + INGEST_LIMITS.maxClockSkewMs)),
        receivedAt: new Date(now),
        visitorId: e.visitorId,
        sessionId: e.sessionId,
        host: page.host,
        path: page.path,
        utm: page.utm,
        referrerHost: ref.host,
        referrerPath: ref.path,
        device,
        screen: e.screen ?? null,
        lang: e.lang ?? null,
        props: e.props && Object.keys(e.props).length ? e.props : null,
        sdkVersion: batch.sdkVersion,
      });
    }
    const rejected = total - valid.length;
    if (valid.length === 0) return { accepted: 0, duplicates: 0, rejected };

    const org = await OrganizationModel.findById(orgId).select({ planKey: 1, limitOverrides: 1 }).lean<Organization>();
    const limits = await this.entitlements.limitsFor(org ?? { planKey: 'free', limitOverrides: {} });
    const granted = await this.entitlements.reserveEvents(orgId, limits.monthlyEvents, valid.length);
    if (granted === 0) {
      throw new AppError(429, 'QUOTA_EXCEEDED', 'This site has reached its monthly event quota');
    }
    const toStore = valid.slice(0, granted);
    const expiresAt = new Date(now + limits.analyticsRetentionDays * 86_400_000);

    let stored = toStore.length;
    try {
      await AnalyticsEventModel.insertMany(toStore.map((e) => ({ ...e, expiresAt })), { ordered: false, lean: true });
    } catch (err) {
      const e = err as { code?: number; writeErrors?: Array<{ code?: number; err?: { code?: number } }>; insertedDocs?: unknown[]; result?: { insertedCount?: number } };
      const writeErrors = e.writeErrors ?? [];
      const allDuplicates = writeErrors.length > 0 && writeErrors.every((w) => (w.code ?? w.err?.code) === 11000);
      if (!allDuplicates && e.code !== 11000) {
        await this.entitlements.settleEvents(orgId, granted, 0);
        throw err;
      }
      stored = toStore.length - Math.max(writeErrors.length, 1);
    }
    await this.entitlements.settleEvents(orgId, granted, stored);
    const duplicates = toStore.length - stored;

    if (stored > 0) {
      await this.websites.recordActivity({ _id: websiteId, orgId }, batch.sdkVersion).catch((err: unknown) => {
        logger.error({ err, websiteId: site.websiteId }, 'Failed to record installation activity');
      });
    }
    return { accepted: stored, duplicates, rejected: rejected + (valid.length - granted) };
  }
}
