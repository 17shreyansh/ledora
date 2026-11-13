import type { InvitationDto, MemberDto, OrganizationDto, UserDto } from '@ledora/shared';
import type { Invitation } from '../modules/memberships/invitation.model.js';
import type { Membership } from '../modules/memberships/membership.model.js';
import type { Organization } from '../modules/organizations/organization.model.js';
import type { User } from '../modules/users/user.model.js';

export function toUserDto(u: User): UserDto {
  return {
    id: u._id.toHexString(),
    email: u.email,
    name: u.name,
    emailVerified: u.emailVerifiedAt !== null,
    createdAt: u.createdAt.toISOString(),
  };
}

export function toOrgDto(o: Organization): OrganizationDto {
  return {
    id: o._id.toHexString(),
    name: o.name,
    slug: o.slug,
    timezone: o.timezone,
    createdAt: o.createdAt.toISOString(),
  };
}

export function toMemberDto(m: Membership, u: Pick<User, 'name' | 'email'>): MemberDto {
  return {
    userId: m.userId.toHexString(),
    name: u.name,
    email: u.email,
    role: m.role,
    joinedAt: m.createdAt.toISOString(),
  };
}

export function toInvitationDto(i: Invitation, inviter: Pick<User, '_id' | 'name'> | null): InvitationDto {
  return {
    id: i._id.toHexString(),
    email: i.email,
    role: i.role,
    invitedBy: inviter ? { id: inviter._id.toHexString(), name: inviter.name } : null,
    expiresAt: i.expiresAt.toISOString(),
    createdAt: i.createdAt.toISOString(),
  };
}
