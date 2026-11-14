import {
  createInvitationSchema,
  createOrganizationSchema,
  objectIdSchema,
  updateMemberRoleSchema,
  updateOrganizationSchema,
  type AuditLogDto,
} from '@ledora/shared';
import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { requireAuth } from '../../common/middleware/auth.js';
import { authOf, loadOrgContext, orgOf, requirePermission } from '../../common/middleware/orgContext.js';
import { toOrgDto } from '../../common/serializers.js';
import { decodeCursor, encodeCursor } from '../../common/utils/cursor.js';
import { parse } from '../../common/validation.js';
import type { Services } from '../../services/container.js';
import { AuditLogModel, type AuditLog } from '../audit/auditLog.model.js';
import { UserModel, type User } from '../users/user.model.js';
import { websiteRoutes } from '../websites/websites.routes.js';

const idParam = (value: unknown) => new Types.ObjectId(parse(objectIdSchema, value));
const cursorQuery = z.object({ cursor: z.string().max(64).optional() });

export function organizationRoutes(s: Services): Router {
  const r = Router();
  r.use(requireAuth);

  r.post('/', s.limiter('create-org', { windowMs: 60 * 60_000, limit: 20 }), async (req, res) => {
    const input = parse(createOrganizationSchema, req.body);
    const { user } = authOf(req);
    const org = await s.organizations.create(user, input, req.ip ?? null);
    res.status(201).json({ ...toOrgDto(org), role: 'owner' });
  });

  // Everything below is scoped to one organization and requires membership.
  const scoped = Router({ mergeParams: true });
  r.use('/:orgId', loadOrgContext, scoped);

  scoped.get('/', requirePermission('org.read'), (req, res) => {
    const { org, membership } = orgOf(req);
    res.json({ ...toOrgDto(org), role: membership.role });
  });

  scoped.patch('/', requirePermission('org.update'), async (req, res) => {
    const input = parse(updateOrganizationSchema, req.body);
    const { org, membership } = orgOf(req);
    const updated = await s.organizations.update(org, authOf(req).user._id, input, req.ip ?? null);
    res.json({ ...toOrgDto(updated), role: membership.role });
  });

  scoped.delete('/', requirePermission('org.delete'), async (req, res) => {
    const { confirmName } = parse(z.object({ confirmName: z.string().max(100) }), req.body);
    await s.organizations.softDelete(orgOf(req).org, authOf(req).user._id, confirmName, req.ip ?? null);
    res.status(204).end();
  });

  scoped.get('/usage', requirePermission('org.read'), async (req, res) => {
    res.json(await s.entitlements.usage(orgOf(req).org));
  });

  scoped.use('/websites', websiteRoutes(s));

  // ── Members ──
  scoped.get('/members', requirePermission('members.read'), async (req, res) => {
    const { cursor } = parse(cursorQuery, req.query);
    res.json(await s.members.list(orgOf(req).org._id, cursor));
  });

  scoped.patch('/members/:userId', async (req, res) => {
    const { role } = parse(updateMemberRoleSchema, req.body);
    const member = await s.members.changeRole(orgOf(req).membership, idParam(req.params.userId), role, req.ip ?? null);
    res.json(member);
  });

  scoped.delete('/members/:userId', async (req, res) => {
    await s.members.remove(orgOf(req).membership, idParam(req.params.userId), req.ip ?? null);
    res.status(204).end();
  });

  // ── Invitations ──
  scoped.get('/invitations', requirePermission('members.invite'), async (req, res) => {
    res.json(await s.invitations.listPending(orgOf(req).org._id));
  });

  scoped.post(
    '/invitations',
    requirePermission('members.invite'),
    s.limiter('invite', { windowMs: 60 * 60_000, limit: 50 }),
    async (req, res) => {
      const input = parse(createInvitationSchema, req.body);
      const { org, membership } = orgOf(req);
      const invitation = await s.invitations.create(org, membership, authOf(req).user, input, req.ip ?? null);
      res.status(201).json(invitation);
    },
  );

  scoped.delete('/invitations/:invitationId', requirePermission('members.invite'), async (req, res) => {
    await s.invitations.revoke(orgOf(req).org._id, idParam(req.params.invitationId), authOf(req).user._id, req.ip ?? null);
    res.status(204).end();
  });

  // ── Audit log ──
  scoped.get('/audit-logs', requirePermission('audit.read'), async (req, res) => {
    const { cursor } = parse(cursorQuery, req.query);
    const before = decodeCursor(cursor);
    const limit = 50;
    const rows = await AuditLogModel.find({ orgId: orgOf(req).org._id, ...(before ? { _id: { $lt: before } } : {}) })
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean<AuditLog[]>();
    const page = rows.slice(0, limit);
    const actorIds = [...new Set(page.flatMap((a) => (a.actorId ? [a.actorId.toHexString()] : [])))];
    const actors = await UserModel.find({ _id: { $in: actorIds } }).select({ name: 1 }).lean<Pick<User, '_id' | 'name'>[]>();
    const names = new Map(actors.map((u) => [u._id.toHexString(), u.name]));
    const items: AuditLogDto[] = page.map((a) => ({
      id: a._id.toHexString(),
      action: a.action,
      actor: {
        type: a.actorType,
        id: a.actorId?.toHexString() ?? null,
        name: a.actorId ? (names.get(a.actorId.toHexString()) ?? 'Former member') : null,
      },
      target: a.targetType ? { type: a.targetType, id: a.targetId } : null,
      metadata: a.metadata,
      createdAt: a.createdAt.toISOString(),
    }));
    res.json({ items, nextCursor: rows.length > limit ? encodeCursor(page[page.length - 1]!._id) : null });
  });

  return r;
}

export function invitationRoutes(s: Services): Router {
  const r = Router();
  const limit = s.limiter('invitation-token', { windowMs: 15 * 60_000, limit: 60 });

  // Token travels in the body, not the URL, so it stays out of access logs.
  r.post('/preview', limit, async (req, res) => {
    const { token } = parse(z.object({ token: z.string().min(20).max(200) }), req.body);
    res.json(await s.invitations.preview(token));
  });

  r.post('/accept', requireAuth, limit, async (req, res) => {
    const { token } = parse(z.object({ token: z.string().min(20).max(200) }), req.body);
    const org = await s.invitations.accept(authOf(req).user, token, req.ip ?? null);
    res.json({ organization: toOrgDto(org) });
  });

  return r;
}
