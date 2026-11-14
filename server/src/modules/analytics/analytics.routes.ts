import { analyticsQuerySchema, breakdownQuerySchema, objectIdSchema } from '@ledora/shared';
import { Router } from 'express';
import { z } from 'zod';
import { orgOf, requirePermission } from '../../common/middleware/orgContext.js';
import { parse } from '../../common/validation.js';
import type { Services } from '../../services/container.js';

/** Mounted at /orgs/:orgId/analytics behind loadOrgContext. */
export function analyticsRoutes(s: Services): Router {
  const r = Router({ mergeParams: true });
  r.use(requirePermission('analytics.read'));
  // Dashboards poll; keep them away from the general per-IP budget pressure.
  r.use(s.limiter('analytics', { windowMs: 60_000, limit: 300 }));

  r.get('/overview', async (req, res) => {
    const q = parse(analyticsQuerySchema, req.query);
    res.json(await s.analytics.overview(orgOf(req).org, q));
  });

  r.get('/breakdown', async (req, res) => {
    const q = parse(analyticsQuerySchema, req.query);
    const b = parse(breakdownQuerySchema, req.query);
    res.json(await s.analytics.breakdown(orgOf(req).org, { ...q, ...b }));
  });

  r.get('/realtime', async (req, res) => {
    const { websiteId } = parse(z.object({ websiteId: objectIdSchema.optional() }), req.query);
    res.json(await s.analytics.realtime(orgOf(req).org, websiteId));
  });

  return r;
}
