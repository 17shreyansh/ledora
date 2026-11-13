import { changePasswordSchema, updateProfileSchema, type OrganizationWithRoleDto } from '@ledora/shared';
import { Router } from 'express';
import { requireAuth, setSessionCookie } from '../../common/middleware/auth.js';
import { authOf, clientMeta } from '../../common/middleware/orgContext.js';
import { toOrgDto, toUserDto } from '../../common/serializers.js';
import { parse } from '../../common/validation.js';
import type { Services } from '../../services/container.js';
import { UserModel, type User } from './user.model.js';

export function meRoutes(s: Services): Router {
  const r = Router();
  r.use(requireAuth);

  r.get('/', (req, res) => {
    res.json(toUserDto(authOf(req).user));
  });

  r.patch('/', async (req, res) => {
    const { name } = parse(updateProfileSchema, req.body);
    const user = await UserModel.findByIdAndUpdate(authOf(req).user._id, { $set: { name } }, { new: true }).lean<User>();
    res.json(toUserDto(user!));
  });

  r.post('/password', s.limiter('change-password', { windowMs: 15 * 60_000, limit: 10 }), async (req, res) => {
    const input = parse(changePasswordSchema, req.body);
    const { rawToken } = await s.auth.changePassword(authOf(req).user._id, input.currentPassword, input.newPassword, clientMeta(req));
    setSessionCookie(res, s.config, rawToken);
    res.json({ csrfToken: s.auth.csrfTokenFor(rawToken) });
  });

  r.get('/organizations', async (req, res) => {
    const list = await s.organizations.listForUser(authOf(req).user._id);
    const body: OrganizationWithRoleDto[] = list.map(({ org, role }) => ({ ...toOrgDto(org), role }));
    res.json(body);
  });

  return r;
}
