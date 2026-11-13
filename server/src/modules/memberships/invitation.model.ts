import { ORG_ROLES, type OrgRole } from '@ledora/shared';
import { Schema, model, type Types } from 'mongoose';

export interface Invitation {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  email: string;
  role: OrgRole;
  tokenHash: string;
  invitedBy: Types.ObjectId;
  status: 'pending' | 'accepted' | 'revoked';
  expiresAt: Date;
  acceptedBy: Types.ObjectId | null;
  acceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const invitationSchema = new Schema<Invitation>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    role: { type: String, enum: ORG_ROLES, required: true },
    tokenHash: { type: String, required: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'accepted', 'revoked'], default: 'pending' },
    expiresAt: { type: Date, required: true },
    acceptedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    acceptedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: 'throw' },
);

invitationSchema.index({ tokenHash: 1 }, { unique: true });
// At most one pending invitation per email per organization.
invitationSchema.index(
  { orgId: 1, email: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
);
invitationSchema.index({ orgId: 1, status: 1, createdAt: -1 });

export const InvitationModel = model<Invitation>('Invitation', invitationSchema, 'invitations');
