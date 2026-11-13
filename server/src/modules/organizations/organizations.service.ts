import { slugify, validateSlug, type CreateOrganizationInput, type UpdateOrganizationInput } from '@ledora/shared';
import { randomBytes } from 'node:crypto';
import type { Types } from 'mongoose';
import { AppError } from '../../common/errors/AppError.js';
import { withTransaction } from '../../database/transaction.js';
import type { AuditService } from '../audit/audit.service.js';
import { MembershipModel, type Membership } from '../memberships/membership.model.js';
import type { User } from '../users/user.model.js';
import { OrganizationModel, OrgSlugAliasModel, type Organization } from './organization.model.js';

function isDuplicateKey(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

export class OrganizationsService {
  constructor(
    private readonly audit: AuditService,
    private readonly maxOrgsPerUser: number,
  ) {}

  async listForUser(userId: Types.ObjectId): Promise<Array<{ org: Organization; role: Membership['role'] }>> {
    const memberships = await MembershipModel.find({ userId }).lean<Membership[]>();
    if (memberships.length === 0) return [];
    const orgs = await OrganizationModel.find({
      _id: { $in: memberships.map((m) => m.orgId) },
      status: 'active',
    })
      .sort({ name: 1 })
      .lean<Organization[]>();
    const roleByOrg = new Map(memberships.map((m) => [m.orgId.toHexString(), m.role]));
    return orgs.map((org) => ({ org, role: roleByOrg.get(org._id.toHexString())! }));
  }

  /** A slug is available if no other organization uses it now or used it before. */
  private async slugTaken(slug: string, exceptOrgId?: Types.ObjectId): Promise<boolean> {
    const [org, alias] = await Promise.all([
      OrganizationModel.exists({ slug, ...(exceptOrgId ? { _id: { $ne: exceptOrgId } } : {}) }),
      OrgSlugAliasModel.findOne({ slug }).lean(),
    ]);
    return Boolean(org) || Boolean(alias && (!exceptOrgId || !alias.orgId.equals(exceptOrgId)));
  }

  private async generateSlug(name: string): Promise<string> {
    let base = slugify(name);
    if (validateSlug(base) !== null) base = `${(base || 'org').slice(0, 30)}-team`;
    if (validateSlug(base) === null && !(await this.slugTaken(base))) return base;
    for (let i = 0; i < 5; i++) {
      const candidate = `${base.slice(0, 40)}-${randomBytes(3).toString('hex')}`;
      if (validateSlug(candidate) === null && !(await this.slugTaken(candidate))) return candidate;
    }
    throw new AppError(503, 'SERVICE_UNAVAILABLE', 'Could not allocate an organization address; try again');
  }

  async create(user: User, input: CreateOrganizationInput & { timezone: string }, ip: string | null): Promise<Organization> {
    if (!user.emailVerifiedAt) {
      throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email address before creating an organization');
    }
    const ownerships = await MembershipModel.find({ userId: user._id, role: 'owner' }).select({ orgId: 1 }).lean<Pick<Membership, 'orgId'>[]>();
    const owned = await OrganizationModel.countDocuments({ _id: { $in: ownerships.map((m) => m.orgId) }, status: 'active' });
    if (owned >= this.maxOrgsPerUser) {
      throw AppError.forbidden(`You can own at most ${this.maxOrgsPerUser} organizations`);
    }

    let slug: string;
    if (input.slug) {
      if (await this.slugTaken(input.slug)) throw AppError.conflict('This address is taken', { slug: 'This address is taken' });
      slug = input.slug;
    } else {
      slug = await this.generateSlug(input.name);
    }

    try {
      return await withTransaction(async (session) => {
        const [org] = await OrganizationModel.create(
          [{ name: input.name, slug, timezone: input.timezone, createdBy: user._id }],
          { session },
        );
        await MembershipModel.create([{ orgId: org!._id, userId: user._id, role: 'owner' }], { session });
        await this.audit.record(
          { action: 'org.created', orgId: org!._id, actorId: user._id, target: { type: 'organization', id: org!._id }, metadata: { slug }, ip },
          session,
        );
        return org!.toObject();
      });
    } catch (err) {
      if (isDuplicateKey(err)) throw AppError.conflict('This address is taken', { slug: 'This address is taken' });
      throw err;
    }
  }

  async update(org: Organization, actorId: Types.ObjectId, input: UpdateOrganizationInput, ip: string | null): Promise<Organization> {
    const changes: Record<string, unknown> = {};
    if (input.name !== undefined && input.name !== org.name) changes.name = input.name;
    if (input.timezone !== undefined && input.timezone !== org.timezone) changes.timezone = input.timezone;
    const slugChanged = input.slug !== undefined && input.slug !== org.slug;
    if (slugChanged) {
      if (await this.slugTaken(input.slug!, org._id)) throw AppError.conflict('This address is taken', { slug: 'This address is taken' });
      changes.slug = input.slug;
    }
    if (Object.keys(changes).length === 0) return org;

    try {
      return await withTransaction(async (session) => {
        if (slugChanged) {
          // Reclaiming one of our own old slugs removes it from the alias list.
          await OrgSlugAliasModel.deleteOne({ slug: input.slug, orgId: org._id }, { session });
          await OrgSlugAliasModel.create([{ slug: org.slug, orgId: org._id }], { session });
        }
        const updated = await OrganizationModel.findOneAndUpdate(
          { _id: org._id, status: 'active' },
          { $set: changes },
          { new: true, session },
        ).lean<Organization>();
        if (!updated) throw AppError.notFound();
        await this.audit.record(
          {
            action: 'org.updated',
            orgId: org._id,
            actorId,
            target: { type: 'organization', id: org._id },
            metadata: { fields: Object.keys(changes), ...(slugChanged ? { fromSlug: org.slug, toSlug: input.slug } : {}) },
            ip,
          },
          session,
        );
        return updated;
      });
    } catch (err) {
      if (isDuplicateKey(err)) throw AppError.conflict('This address is taken', { slug: 'This address is taken' });
      throw err;
    }
  }

  /**
   * Soft delete: the organization disappears for every member immediately. Data is
   * retained for the recovery window defined in docs/DATABASE_SCHEMA.md, and the slug
   * stays reserved so its public URLs cannot be taken over.
   */
  async softDelete(org: Organization, actorId: Types.ObjectId, confirmName: string, ip: string | null): Promise<void> {
    if (confirmName.trim() !== org.name) {
      throw AppError.badRequest('Type the organization name exactly to confirm', { confirmName: 'Name does not match' });
    }
    await withTransaction(async (session) => {
      const res = await OrganizationModel.updateOne(
        { _id: org._id, status: 'active' },
        { $set: { status: 'deleted', deletedAt: new Date() } },
        { session },
      );
      if (res.matchedCount === 0) throw AppError.notFound();
      await this.audit.record({ action: 'org.deleted', orgId: org._id, actorId, target: { type: 'organization', id: org._id }, ip }, session);
    });
  }
}
