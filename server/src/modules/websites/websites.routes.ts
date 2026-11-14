import { createWebsiteSchema, objectIdSchema, updateWebsiteSchema } from '@ledora/shared';
import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { authOf, orgOf, requirePermission } from '../../common/middleware/orgContext.js';
import { parse } from '../../common/validation.js';
import type { Services } from '../../services/container.js';
import { toWebsiteDto } from './websites.service.js';

/** Mounted at /orgs/:orgId/websites behind loadOrgContext. */
export function websiteRoutes(s: Services): Router {
  const r = Router({ mergeParams: true });
  const wid = (v: unknown) => new Types.ObjectId(parse(objectIdSchema, v));

  r.get('/', requirePermission('websites.read'), async (req, res) => {
    res.json(await s.websites.list(orgOf(req).org._id));
  });

  r.post('/', requirePermission('websites.manage'), async (req, res) => {
    const input = parse(createWebsiteSchema, req.body);
    const site = await s.websites.create(orgOf(req).org, authOf(req).user._id, input, req.ip ?? null);
    res.status(201).json(site);
  });

  r.get('/:websiteId', requirePermission('websites.read'), async (req, res) => {
    res.json(toWebsiteDto(await s.websites.get(orgOf(req).org._id, wid(req.params.websiteId))));
  });

  r.get('/:websiteId/stats', requirePermission('websites.read'), async (req, res) => {
    res.json(await s.websites.stats(orgOf(req).org._id, wid(req.params.websiteId)));
  });

  r.patch('/:websiteId', requirePermission('websites.manage'), async (req, res) => {
    const input = parse(updateWebsiteSchema, req.body);
    res.json(await s.websites.update(orgOf(req).org._id, wid(req.params.websiteId), authOf(req).user._id, input, req.ip ?? null));
  });

  r.post('/:websiteId/rotate-key', requirePermission('websites.manage'), async (req, res) => {
    res.json(await s.websites.rotateKey(orgOf(req).org._id, wid(req.params.websiteId), authOf(req).user._id, req.ip ?? null));
  });

  r.delete('/:websiteId', requirePermission('websites.manage'), async (req, res) => {
    const { confirmName } = parse(z.object({ confirmName: z.string().max(100) }), req.body);
    await s.websites.remove(orgOf(req).org._id, wid(req.params.websiteId), authOf(req).user._id, confirmName, req.ip ?? null);
    res.status(204).end();
  });

  return r;
}
