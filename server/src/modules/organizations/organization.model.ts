import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export interface Organization {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  timezone: string;
  status: 'active' | 'deleted';
  createdBy: Types.ObjectId;
  /**
   * Incremented inside every membership-changing transaction. Two concurrent
   * transactions that touch the same organization's memberships therefore conflict
   * on this document, which prevents write-skew (e.g. two owners demoting each other
   * and leaving the organization with no owner).
   */
  membershipVersion: number;
  /** Same idea as membershipVersion, for limit-checked resources such as websites. */
  resourceVersion: number;
  /** Key of the subscription plan; limits come from the `plans` collection. */
  planKey: string;
  /** Per-organization limit overrides (enterprise contracts, temporary grants). */
  limitOverrides: Partial<Record<'websites' | 'monthlyEvents' | 'analyticsRetentionDays' | 'teamMembers', number>>;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = new Schema<Organization>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, lowercase: true, maxlength: 48 },
    timezone: { type: String, required: true, default: 'UTC' },
    status: { type: String, enum: ['active', 'deleted'], default: 'active' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    membershipVersion: { type: Number, default: 0 },
    resourceVersion: { type: Number, default: 0 },
    planKey: { type: String, default: 'free', maxlength: 32 },
    limitOverrides: { type: Schema.Types.Mixed, default: {} },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: 'throw', minimize: false },
);

organizationSchema.index({ slug: 1 }, { unique: true });
organizationSchema.index({ createdBy: 1, status: 1 });

export const OrganizationModel = model<Organization>('Organization', organizationSchema, 'organizations');
export type OrganizationDoc = HydratedDocument<Organization>;

/**
 * Previous slugs of an organization. They keep resolving (for redirects of hosted
 * form URLs) and can never be claimed by another organization.
 */
export interface OrgSlugAlias {
  _id: Types.ObjectId;
  slug: string;
  orgId: Types.ObjectId;
  createdAt: Date;
}

const orgSlugAliasSchema = new Schema<OrgSlugAlias>(
  {
    slug: { type: String, required: true, lowercase: true, maxlength: 48 },
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw' },
);
orgSlugAliasSchema.index({ slug: 1 }, { unique: true });
orgSlugAliasSchema.index({ orgId: 1 });

export const OrgSlugAliasModel = model<OrgSlugAlias>('OrgSlugAlias', orgSlugAliasSchema, 'orgSlugAliases');
