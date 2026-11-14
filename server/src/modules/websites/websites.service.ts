import type { CreateWebsiteInput, UpdateWebsiteInput, WebsiteDto, WebsiteStatsDto } from '@ledora/shared';
import { randomBytes } from 'node:crypto';
import type { Redis } from 'ioredis';
import type { Types } from 'mongoose';
import { AppError } from '../../common/errors/AppError.js';
import { withTransaction } from '../../database/transaction.js';
import { AnalyticsEventModel } from '../ingest/analyticsEvent.model.js';
import type { AuditService } from '../audit/audit.service.js';
import { EntitlementsService } from '../entitlements/entitlements.service.js';
import { emitEvent } from '../events/events.js';
import { OrganizationModel, type Organization } from '../organizations/organization.model.js';
import { WebsiteModel, type Website } from './website.model.js';

export function generateSiteKey(): string {
  return `ldr_${randomBytes(15).toString('base64url')}`;
}

/** example.com ⇄ www.example.com are almost always the same site. */
export function defaultAllowedDomains(domain: string): string[] {
  if (domain === 'localhost') return ['localhost'];
  const counterpart = domain.startsWith('www.') ? domain.slice(4) : `www.${domain}`;
  return counterpart.includes('.') ? [domain, counterpart] : [domain];
}

export function toWebsiteDto(w: Website): WebsiteDto {
  return {
    id: w._id.toHexString(),
    name: w.name,
    domain: w.domain,
    allowedDomains: w.allowedDomains,
    siteKey: w.siteKey,
    tracking: { consentRequired: w.tracking.consentRequired, respectDoNotTrack: w.tracking.respectDoNotTrack },
    installation: {
      status: w.installation.firstSeenAt ? 'verified' : 'not_installed',
      firstSeenAt: w.installation.firstSeenAt?.toISOString() ?? null,
      lastSeenAt: w.installation.lastSeenAt?.toISOString() ?? null,
      sdkVersion: w.installation.sdkVersion,
    },
    createdAt: w.createdAt.toISOString(),
  };
}

const SITE_CACHE_PREFIX = 'site:';

export class WebsitesService {
  constructor(
    private readonly redis: Redis,
    private readonly audit: AuditService,
    private readonly entitlements: EntitlementsService,
  ) {}

  /** Drop the public-config cache for a site key (after edits, rotation, deletion). */
  async invalidateSiteCache(siteKey: string): Promise<void> {
    await this.redis.del(`${SITE_CACHE_PREFIX}${siteKey}`);
  }

  async list(orgId: Types.ObjectId): Promise<WebsiteDto[]> {
    const rows = await WebsiteModel.find({ orgId, status: 'active' }).sort({ createdAt: 1 }).limit(1000).lean<Website[]>();
    return rows.map(toWebsiteDto);
  }

  async get(orgId: Types.ObjectId, websiteId: Types.ObjectId): Promise<Website> {
    const w = await WebsiteModel.findOne({ _id: websiteId, orgId, status: 'active' }).lean<Website>();
    if (!w) throw AppError.notFound('Website not found');
    return w;
  }

  async create(org: Organization, actorId: Types.ObjectId, input: CreateWebsiteInput, ip: string | null): Promise<WebsiteDto> {
    const limits = await this.entitlements.limitsFor(org);
    const created = await withTransaction(async (session) => {
      // Serialise concurrent creates for this org so the limit cannot be overshot.
      await OrganizationModel.updateOne({ _id: org._id, status: 'active' }, { $inc: { resourceVersion: 1 } }, { session });
      const count = await WebsiteModel.countDocuments({ orgId: org._id, status: 'active' }).session(session);
      if (count >= limits.websites) throw EntitlementsService.limitReached(limits.websites === 1 ? 'website' : 'websites', limits.websites);
      const [w] = await WebsiteModel.create(
        [{
          orgId: org._id,
          name: input.name,
          domain: input.domain,
          allowedDomains: defaultAllowedDomains(input.domain),
          siteKey: generateSiteKey(),
          createdBy: actorId,
        }],
        { session },
      );
      await this.audit.record(
        { action: 'website.created', orgId: org._id, actorId, target: { type: 'website', id: w!._id }, metadata: { name: input.name, domain: input.domain }, ip },
        session,
      );
      return w!.toObject();
    });
    return toWebsiteDto(created);
  }

  async update(orgId: Types.ObjectId, websiteId: Types.ObjectId, actorId: Types.ObjectId, input: UpdateWebsiteInput, ip: string | null): Promise<WebsiteDto> {
    const current = await this.get(orgId, websiteId);
    const set: Record<string, unknown> = {};
    if (input.name !== undefined) set.name = input.name;
    if (input.allowedDomains !== undefined) set.allowedDomains = input.allowedDomains;
    if (input.tracking?.consentRequired !== undefined) set['tracking.consentRequired'] = input.tracking.consentRequired;
    if (input.tracking?.respectDoNotTrack !== undefined) set['tracking.respectDoNotTrack'] = input.tracking.respectDoNotTrack;
    const updated = await WebsiteModel.findOneAndUpdate({ _id: websiteId, orgId, status: 'active' }, { $set: set }, { new: true }).lean<Website>();
    if (!updated) throw AppError.notFound('Website not found');
    await this.invalidateSiteCache(current.siteKey);
    await this.audit.record({ action: 'website.updated', orgId, actorId, target: { type: 'website', id: websiteId }, metadata: { fields: Object.keys(set), name: updated.name }, ip });
    return toWebsiteDto(updated);
  }

  async rotateKey(orgId: Types.ObjectId, websiteId: Types.ObjectId, actorId: Types.ObjectId, ip: string | null): Promise<WebsiteDto> {
    const current = await this.get(orgId, websiteId);
    const updated = await WebsiteModel.findOneAndUpdate(
      { _id: websiteId, orgId, status: 'active' },
      { $set: { siteKey: generateSiteKey() } },
      { new: true },
    ).lean<Website>();
    if (!updated) throw AppError.notFound('Website not found');
    await this.invalidateSiteCache(current.siteKey);
    await this.audit.record({ action: 'website.key_rotated', orgId, actorId, target: { type: 'website', id: websiteId }, metadata: { name: updated.name }, ip });
    return toWebsiteDto(updated);
  }

  async remove(orgId: Types.ObjectId, websiteId: Types.ObjectId, actorId: Types.ObjectId, confirmName: string, ip: string | null): Promise<void> {
    const current = await this.get(orgId, websiteId);
    if (confirmName.trim() !== current.name) {
      throw AppError.badRequest('Type the website name exactly to confirm', { confirmName: 'Name does not match' });
    }
    await WebsiteModel.updateOne({ _id: websiteId, orgId }, { $set: { status: 'deleted', deletedAt: new Date() } });
    await this.invalidateSiteCache(current.siteKey);
    await this.audit.record({ action: 'website.deleted', orgId, actorId, target: { type: 'website', id: websiteId }, metadata: { name: current.name, domain: current.domain }, ip });
  }

  async stats(orgId: Types.ObjectId, websiteId: Types.ObjectId): Promise<WebsiteStatsDto> {
    await this.get(orgId, websiteId);
    const since = new Date(Date.now() - 86_400_000);
    const [events, pageviews, last] = await Promise.all([
      AnalyticsEventModel.countDocuments({ websiteId, ts: { $gte: since } }),
      AnalyticsEventModel.countDocuments({ websiteId, ts: { $gte: since }, type: 'pageview' }),
      AnalyticsEventModel.findOne({ websiteId }).sort({ ts: -1 }).select({ ts: 1 }).lean(),
    ]);
    return { eventsLast24h: events, pageviewsLast24h: pageviews, lastEventAt: last?.ts.toISOString() ?? null };
  }

  /**
   * Records SDK activity. The first accepted event marks the installation as verified
   * and emits `website.installation_verified` in the same transaction.
   */
  async recordActivity(website: Pick<Website, '_id' | 'orgId'>, sdkVersion: string): Promise<void> {
    const throttleKey = `site-seen:${website._id.toHexString()}`;
    if ((await this.redis.set(throttleKey, '1', 'EX', 60, 'NX')) !== 'OK') return;
    const now = new Date();
    await withTransaction(async (session) => {
      const first = await WebsiteModel.updateOne(
        { _id: website._id, 'installation.firstSeenAt': null },
        { $set: { 'installation.firstSeenAt': now } },
        { session },
      );
      await WebsiteModel.updateOne(
        { _id: website._id },
        { $set: { 'installation.lastSeenAt': now, 'installation.sdkVersion': sdkVersion } },
        { session },
      );
      if (first.modifiedCount === 1) {
        await emitEvent(session, {
          type: 'website.installation_verified',
          orgId: website.orgId,
          websiteId: website._id,
          subject: { kind: 'website', id: website._id.toHexString() },
          data: { sdkVersion },
        });
      }
    });
  }
}
