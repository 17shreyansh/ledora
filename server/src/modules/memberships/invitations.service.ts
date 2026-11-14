import {
  canGrantRole,
  ROLE_LABELS,
  type CreateInvitationInput,
  type InvitationDto,
  type InvitationPreviewDto,
} from '@ledora/shared';
import type { Types } from 'mongoose';
import type { Config } from '../../config/env.js';
import { AppError } from '../../common/errors/AppError.js';
import { toInvitationDto } from '../../common/serializers.js';
import { generateToken, hashToken } from '../../common/utils/tokens.js';
import { withTransaction } from '../../database/transaction.js';
import type { MailDispatcher } from '../../services/mail/dispatcher.js';
import type { AuditService } from '../audit/audit.service.js';
import { EntitlementsService } from '../entitlements/entitlements.service.js';
import { OrganizationModel, type Organization } from '../organizations/organization.model.js';
import { UserModel, type User } from '../users/user.model.js';
import { InvitationModel, type Invitation } from './invitation.model.js';
import { lockMemberships } from './members.service.js';
import { MembershipModel, type Membership } from './membership.model.js';

const INVITATION_TTL_MS = 7 * 86_400_000;
const MAX_PENDING_PER_ORG = 100;

export class InvitationsService {
  constructor(
    private readonly config: Config,
    private readonly mail: MailDispatcher,
    private readonly audit: AuditService,
    private readonly entitlements: EntitlementsService,
  ) {}

  private tokenHash(raw: string) {
    return hashToken(this.config.AUTH_SECRET, raw, 'invitation');
  }

  async listPending(orgId: Types.ObjectId): Promise<InvitationDto[]> {
    const invitations = await InvitationModel.find({ orgId, status: 'pending', expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 })
      .limit(MAX_PENDING_PER_ORG)
      .lean<Invitation[]>();
    const inviters = await UserModel.find({ _id: { $in: invitations.map((i) => i.invitedBy) } })
      .select({ name: 1 })
      .lean<Pick<User, '_id' | 'name'>[]>();
    const byId = new Map(inviters.map((u) => [u._id.toHexString(), u]));
    return invitations.map((i) => toInvitationDto(i, byId.get(i.invitedBy.toHexString()) ?? null));
  }

  async create(org: Organization, actor: Membership, inviter: User, input: CreateInvitationInput, ip: string | null): Promise<InvitationDto> {
    if (!canGrantRole(actor.role, input.role)) throw AppError.forbidden('You cannot invite someone with this role');

    const existingUser = await UserModel.findOne({ email: input.email }).select({ _id: 1 }).lean();
    if (existingUser && (await MembershipModel.exists({ orgId: org._id, userId: existingUser._id }))) {
      throw AppError.conflict('This person is already a member', { email: 'Already a member of this organization' });
    }
    const pending = await InvitationModel.countDocuments({ orgId: org._id, status: 'pending', expiresAt: { $gt: new Date() } });
    if (pending >= MAX_PENDING_PER_ORG) throw AppError.conflict('Too many pending invitations. Revoke some first.');
    const { teamMembers } = await this.entitlements.limitsFor(org);
    const members = await MembershipModel.countDocuments({ orgId: org._id });
    // Pending invitations to other people count as seats, except the one this replaces.
    const otherPending = await InvitationModel.countDocuments({ orgId: org._id, status: 'pending', expiresAt: { $gt: new Date() }, email: { $ne: input.email } });
    if (members + otherPending >= teamMembers) {
      throw EntitlementsService.limitReached('team members (including pending invitations)', teamMembers);
    }

    const raw = generateToken();
    const invitation = await withTransaction(async (session) => {
      // Re-inviting replaces the previous pending invitation (and invalidates its link).
      await InvitationModel.updateMany(
        { orgId: org._id, email: input.email, status: 'pending' },
        { $set: { status: 'revoked' } },
        { session },
      );
      const [created] = await InvitationModel.create(
        [{
          orgId: org._id,
          email: input.email,
          role: input.role,
          tokenHash: this.tokenHash(raw),
          invitedBy: inviter._id,
          expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
        }],
        { session },
      );
      await this.audit.record(
        { action: 'invitation.created', orgId: org._id, actorId: inviter._id, target: { type: 'invitation', id: created!._id }, metadata: { role: input.role, email: input.email }, ip },
        session,
      );
      return created!.toObject();
    });

    await this.mail.dispatch({
      to: input.email,
      template: 'invitation',
      data: {
        inviterName: inviter.name,
        organizationName: org.name,
        roleLabel: ROLE_LABELS[input.role],
        link: `${this.config.APP_URL}/invitations/accept?token=${encodeURIComponent(raw)}`,
      },
    });
    return toInvitationDto(invitation, inviter);
  }

  async revoke(orgId: Types.ObjectId, invitationId: Types.ObjectId, actorId: Types.ObjectId, ip: string | null): Promise<void> {
    const revoked = await InvitationModel.findOneAndUpdate(
      { _id: invitationId, orgId, status: 'pending' },
      { $set: { status: 'revoked' } },
    ).lean<Invitation>();
    if (!revoked) throw AppError.notFound('Invitation not found');
    await this.audit.record({
      action: 'invitation.revoked',
      orgId,
      actorId,
      target: { type: 'invitation', id: invitationId },
      metadata: { role: revoked.role, email: revoked.email },
      ip,
    });
  }

  private async findUsable(raw: string): Promise<{ invitation: Invitation; org: Organization }> {
    const invitation = await InvitationModel.findOne({ tokenHash: this.tokenHash(raw) }).lean<Invitation>();
    if (!invitation || invitation.status !== 'pending' || invitation.expiresAt.getTime() <= Date.now()) {
      throw new AppError(400, 'TOKEN_INVALID', 'This invitation is invalid, has expired or was already used');
    }
    const org = await OrganizationModel.findOne({ _id: invitation.orgId, status: 'active' }).lean<Organization>();
    if (!org) throw new AppError(400, 'TOKEN_INVALID', 'This invitation is no longer valid');
    return { invitation, org };
  }

  async preview(raw: string): Promise<InvitationPreviewDto> {
    const { invitation, org } = await this.findUsable(raw);
    return {
      organizationName: org.name,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }

  async accept(user: User, raw: string, ip: string | null): Promise<Organization> {
    const { invitation, org } = await this.findUsable(raw);
    if (!user.emailVerifiedAt) {
      throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email address before accepting invitations');
    }
    if (invitation.email !== user.email) {
      throw AppError.forbidden(`This invitation was sent to ${invitation.email}. Sign in with that address to accept it.`);
    }
    await withTransaction(async (session) => {
      await lockMemberships(org._id, session);
      const claimed = await InvitationModel.updateOne(
        { _id: invitation._id, status: 'pending' },
        { $set: { status: 'accepted', acceptedBy: user._id, acceptedAt: new Date() } },
        { session },
      );
      if (claimed.modifiedCount === 0) throw new AppError(400, 'TOKEN_INVALID', 'This invitation was already used');
      const alreadyMember = await MembershipModel.exists({ orgId: org._id, userId: user._id }).session(session);
      if (!alreadyMember) {
        const { teamMembers } = await this.entitlements.limitsFor(org);
        const members = await MembershipModel.countDocuments({ orgId: org._id }).session(session);
        if (members >= teamMembers) {
          throw new AppError(403, 'PLAN_LIMIT', `${org.name} has reached its team member limit. Ask an owner to free a seat or upgrade.`);
        }
      }
      // An existing member keeps their current role; accepting never downgrades anyone.
      await MembershipModel.updateOne(
        { orgId: org._id, userId: user._id },
        { $setOnInsert: { role: invitation.role } },
        { upsert: true, session },
      );
      await this.audit.record(
        { action: 'invitation.accepted', orgId: org._id, actorId: user._id, target: { type: 'invitation', id: invitation._id }, metadata: { role: invitation.role }, ip },
        session,
      );
    });
    return org;
  }
}
