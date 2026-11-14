import type { UsageDto } from '@ledora/shared';
import type { Redis } from 'ioredis';
import type { Types } from 'mongoose';
import { AppError } from '../../common/errors/AppError.js';
import { MembershipModel } from '../memberships/membership.model.js';
import type { Organization } from '../organizations/organization.model.js';
import { WebsiteModel } from '../websites/website.model.js';
import { DEFAULT_PLANS, LIMIT_KEYS, PlanModel, type Limits, type Plan } from './plan.model.js';
import { UsageRecordModel, usagePeriod } from './usageRecord.model.js';

type PlanLike = Pick<Plan, 'key' | 'name' | 'limits'>;
const PLAN_CACHE_MS = 60_000;

/**
 * Subscription entitlements: what an organization's plan allows. Enforced here on the
 * server; the web app only displays them. Separate from feature flags (Part 32.9).
 */
export class EntitlementsService {
  private planCache = new Map<string, { plan: PlanLike; at: number }>();

  constructor(private readonly redis: Redis) {}

  async planFor(org: Pick<Organization, 'planKey'>): Promise<PlanLike> {
    const key = org.planKey || 'free';
    const cached = this.planCache.get(key);
    if (cached && Date.now() - cached.at < PLAN_CACHE_MS) return cached.plan;
    const stored = await PlanModel.findOne({ key, active: true }).lean<Plan>();
    // A missing plan document falls back to the built-in catalogue, then to Free.
    const plan: PlanLike = stored ?? DEFAULT_PLANS.find((p) => p.key === key) ?? DEFAULT_PLANS[0]!;
    this.planCache.set(key, { plan, at: Date.now() });
    return plan;
  }

  async limitsFor(org: Pick<Organization, 'planKey' | 'limitOverrides'>): Promise<Limits> {
    const plan = await this.planFor(org);
    const limits = { ...plan.limits };
    for (const k of LIMIT_KEYS) {
      const v = org.limitOverrides?.[k];
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) limits[k] = v;
    }
    return limits;
  }

  // ── Monthly event quota ──
  // Redis holds a fast reservation counter per org-month; MongoDB holds the durable count.

  private quotaKey(orgId: Types.ObjectId, period: string) {
    return `usage:events:${orgId.toHexString()}:${period}`;
  }

  private async warmCounter(orgId: Types.ObjectId, period: string): Promise<string> {
    const key = this.quotaKey(orgId, period);
    if ((await this.redis.exists(key)) === 0) {
      const rec = await UsageRecordModel.findOne({ orgId, period }).lean();
      await this.redis.set(key, String(rec?.events ?? 0), 'EX', 40 * 86_400, 'NX');
    }
    return key;
  }

  /** Reserves `n` events against the monthly quota. Returns how many were granted (0..n). */
  async reserveEvents(orgId: Types.ObjectId, limit: number, n: number): Promise<number> {
    const period = usagePeriod();
    const key = await this.warmCounter(orgId, period);
    const after = await this.redis.incrby(key, n);
    if (after <= limit) return n;
    const over = Math.min(n, after - limit);
    await this.redis.decrby(key, over);
    return n - over;
  }

  /** Returns reserved-but-unused events (duplicates, rejects) and records the stored ones. */
  async settleEvents(orgId: Types.ObjectId, reserved: number, stored: number): Promise<void> {
    const period = usagePeriod();
    if (reserved > stored) await this.redis.decrby(this.quotaKey(orgId, period), reserved - stored);
    if (stored > 0) {
      await UsageRecordModel.updateOne({ orgId, period }, { $inc: { events: stored } }, { upsert: true });
    }
  }

  async usage(org: Organization): Promise<UsageDto> {
    const period = usagePeriod();
    const [plan, limits, websites, teamMembers, record] = await Promise.all([
      this.planFor(org),
      this.limitsFor(org),
      WebsiteModel.countDocuments({ orgId: org._id, status: 'active' }),
      MembershipModel.countDocuments({ orgId: org._id }),
      UsageRecordModel.findOne({ orgId: org._id, period }).lean(),
    ]);
    return {
      period,
      plan: { key: plan.key, name: plan.name },
      limits,
      usage: { websites, monthlyEvents: record?.events ?? 0, teamMembers },
    };
  }

  static limitReached(what: string, limit: number): AppError {
    return new AppError(403, 'PLAN_LIMIT', `Your plan allows ${limit} ${what}. Upgrade your plan or remove one to add another.`);
  }
}
