import { hasPermission, objectIdSchema, type Permission } from '@ledora/shared';
import { Types } from 'mongoose';
import type { Request, RequestHandler } from 'express';
import { MembershipModel, type Membership } from '../../modules/memberships/membership.model.js';
import { OrganizationModel, type Organization } from '../../modules/organizations/organization.model.js';
import { AppError } from '../errors/AppError.js';

/**
 * Tenant boundary for every `/orgs/:orgId/*` route. The organization id in the URL
 * is only a *claim*: access requires a membership row for the signed-in user. A
 * non-member gets 404, exactly like a non-existent organization, so ids cannot be
 * probed across tenants.
 */
export const loadOrgContext: RequestHandler = async (req, _res, next) => {
  if (!req.auth) return next(AppError.unauthenticated());
  const parsed = objectIdSchema.safeParse(req.params.orgId);
  if (!parsed.success) return next(AppError.notFound('Organization not found'));
  const orgId = new Types.ObjectId(parsed.data);
  const [org, membership] = await Promise.all([
    OrganizationModel.findOne({ _id: orgId, status: 'active' }).lean<Organization>(),
    MembershipModel.findOne({ orgId, userId: req.auth.user._id }).lean<Membership>(),
  ]);
  if (!org || !membership) return next(AppError.notFound('Organization not found'));
  req.org = org;
  req.membership = membership;
  next();
};

export function requirePermission(permission: Permission): RequestHandler {
  return (req, _res, next) => {
    if (!req.membership) return next(AppError.notFound('Organization not found'));
    if (!hasPermission(req.membership.role, permission)) return next(AppError.forbidden());
    next();
  };
}

/** Typed accessors for handlers mounted behind loadOrgContext/requireAuth. */
export function orgOf(req: Request): { org: Organization; membership: Membership } {
  if (!req.org || !req.membership) throw AppError.notFound('Organization not found');
  return { org: req.org, membership: req.membership };
}

export function authOf(req: Request) {
  if (!req.auth) throw AppError.unauthenticated();
  return req.auth;
}

export function clientMeta(req: Request) {
  return { ip: req.ip ?? null, userAgent: req.get('user-agent') ?? null };
}
