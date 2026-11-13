import { ORG_ROLES, type OrgRole } from '@ledora/shared';
import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export interface Membership {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  userId: Types.ObjectId;
  role: OrgRole;
  createdAt: Date;
  updatedAt: Date;
}

const membershipSchema = new Schema<Membership>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ORG_ROLES, required: true },
  },
  { timestamps: true, strict: 'throw' },
);

membershipSchema.index({ orgId: 1, userId: 1 }, { unique: true });
membershipSchema.index({ userId: 1 });
membershipSchema.index({ orgId: 1, role: 1 });

export const MembershipModel = model<Membership>('Membership', membershipSchema, 'memberships');
export type MembershipDoc = HydratedDocument<Membership>;
