import { canGrantRole, canManageMember, hasPermission, type MemberDto, type OrgRole } from '@ledora/shared';
import type { Types} from 'mongoose';
import { type ClientSession } from 'mongoose';
import { AppError } from '../../common/errors/AppError.js';
import { toMemberDto } from '../../common/serializers.js';
import { decodeCursor, encodeCursor } from '../../common/utils/cursor.js';
import { withTransaction } from '../../database/transaction.js';
import type { AuditService } from '../audit/audit.service.js';
import { OrganizationModel } from '../organizations/organization.model.js';
import { UserModel, type User } from '../users/user.model.js';
import { MembershipModel, type Membership } from './membership.model.js';

/**
 * Bumps the organization's membership version inside the transaction. Any two
 * concurrent membership transactions on one organization now write the same
 * document, so MongoDB aborts one of them (and the driver retries it against the
 * committed state). This is what makes the last-owner check below race-free.
 */
export async function lockMemberships(orgId: Types.ObjectId, session: ClientSession): Promise<void> {
  const res = await OrganizationModel.updateOne(
    { _id: orgId, status: 'active' },
    { $inc: { membershipVersion: 1 } },
    { session },
  );
  if (res.matchedCount === 0) throw AppError.notFound();
}

async function assertOwnerRemains(orgId: Types.ObjectId, session: ClientSession): Promise<void> {
  const owners = await MembershipModel.countDocuments({ orgId, role: 'owner' }).session(session);
  if (owners === 0) {
    throw new AppError(409, 'LAST_OWNER', 'An organization needs at least one owner. Make someone else an owner first.');
  }
}

export class MembersService {
  constructor(private readonly audit: AuditService) {}

  async list(orgId: Types.ObjectId, cursor: string | undefined, limit = 100): Promise<{ items: MemberDto[]; nextCursor: string | null }> {
    const after = decodeCursor(cursor);
    const memberships = await MembershipModel.find({ orgId, ...(after ? { _id: { $gt: after } } : {}) })
      .sort({ _id: 1 })
      .limit(limit + 1)
      .lean<Membership[]>();
    const page = memberships.slice(0, limit);
    const users = await UserModel.find({ _id: { $in: page.map((m) => m.userId) } })
      .select({ name: 1, email: 1 })
      .lean<Pick<User, '_id' | 'name' | 'email'>[]>();
    const byId = new Map(users.map((u) => [u._id.toHexString(), u]));
    return {
      items: page.flatMap((m) => {
        const u = byId.get(m.userId.toHexString());
        return u ? [toMemberDto(m, u)] : [];
      }),
      nextCursor: memberships.length > limit ? encodeCursor(page[page.length - 1]!._id) : null,
    };
  }

  async changeRole(actor: Membership, targetUserId: Types.ObjectId, role: OrgRole, ip: string | null): Promise<MemberDto> {
    const isSelf = actor.userId.equals(targetUserId);
    return withTransaction(async (session) => {
      await lockMemberships(actor.orgId, session);
      // Re-read the actor inside the transaction: their own role may have just changed.
      const me = await MembershipModel.findOne({ orgId: actor.orgId, userId: actor.userId }).session(session).lean<Membership>();
      if (!me || !hasPermission(me.role, 'members.manage')) {
        // Only owners may change their own role (e.g. step down once another owner exists).
        if (!(isSelf && me?.role === 'owner')) throw AppError.forbidden();
      }
      const target = await MembershipModel.findOne({ orgId: actor.orgId, userId: targetUserId }).session(session).lean<Membership>();
      if (!target) throw AppError.notFound('Member not found');
      if (isSelf && me!.role !== 'owner') throw AppError.forbidden('You cannot change your own role');
      if (!canManageMember(me!.role, target.role)) throw AppError.forbidden('You cannot change the role of this member');
      if (!canGrantRole(me!.role, role)) throw AppError.forbidden('You cannot grant this role');
      if (target.role === role) {
        const u = await UserModel.findById(targetUserId).session(session).lean<User>();
        return toMemberDto(target, u!);
      }

      const updated = await MembershipModel.findOneAndUpdate(
        { _id: target._id },
        { $set: { role } },
        { new: true, session },
      ).lean<Membership>();
      await assertOwnerRemains(actor.orgId, session);
      await this.audit.record(
        {
          action: 'member.role_changed',
          orgId: actor.orgId,
          actorId: actor.userId,
          target: { type: 'user', id: targetUserId },
          metadata: { from: target.role, to: role },
          ip,
        },
        session,
      );
      const u = await UserModel.findById(targetUserId).session(session).lean<User>();
      return toMemberDto(updated!, u!);
    });
  }

  /** Removes a member, or lets a member leave when `targetUserId` is themselves. */
  async remove(actor: Membership, targetUserId: Types.ObjectId, ip: string | null): Promise<void> {
    const isSelf = actor.userId.equals(targetUserId);
    await withTransaction(async (session) => {
      await lockMemberships(actor.orgId, session);
      const me = await MembershipModel.findOne({ orgId: actor.orgId, userId: actor.userId }).session(session).lean<Membership>();
      if (!me) throw AppError.notFound();
      const target = isSelf ? me : await MembershipModel.findOne({ orgId: actor.orgId, userId: targetUserId }).session(session).lean<Membership>();
      if (!target) throw AppError.notFound('Member not found');
      if (!isSelf) {
        if (!hasPermission(me.role, 'members.manage')) throw AppError.forbidden();
        if (!canManageMember(me.role, target.role)) throw AppError.forbidden('You cannot remove this member');
      }
      await MembershipModel.deleteOne({ _id: target._id }, { session });
      await assertOwnerRemains(actor.orgId, session);
      await this.audit.record(
        {
          action: isSelf ? 'member.left' : 'member.removed',
          orgId: actor.orgId,
          actorId: actor.userId,
          target: { type: 'user', id: targetUserId },
          metadata: { role: target.role },
          ip,
        },
        session,
      );
    });
  }
}
