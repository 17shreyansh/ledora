import type { Redis } from 'ioredis';
import type { Config } from '../config/env.js';
import { createRateLimiterFactory, type RateLimiterFactory } from '../common/middleware/rateLimit.js';
import { AuditService } from '../modules/audit/audit.service.js';
import { AuthService } from '../modules/auth/auth.service.js';
import { EntitlementsService } from '../modules/entitlements/entitlements.service.js';
import { IngestService } from '../modules/ingest/ingest.service.js';
import { WebsitesService } from '../modules/websites/websites.service.js';
import { InvitationsService } from '../modules/memberships/invitations.service.js';
import { MembersService } from '../modules/memberships/members.service.js';
import { OrganizationsService } from '../modules/organizations/organizations.service.js';
import type { MailDispatcher } from './mail/dispatcher.js';

export interface AppDeps {
  config: Config;
  redis: Redis;
  mail: MailDispatcher;
}

export interface Services {
  config: Config;
  redis: Redis;
  audit: AuditService;
  auth: AuthService;
  organizations: OrganizationsService;
  members: MembersService;
  invitations: InvitationsService;
  entitlements: EntitlementsService;
  websites: WebsitesService;
  ingest: IngestService;
  limiter: RateLimiterFactory;
}

export function createServices({ config, redis, mail }: AppDeps): Services {
  const audit = new AuditService(config.AUDIT_RETENTION_DAYS);
  const entitlements = new EntitlementsService(redis);
  const websites = new WebsitesService(redis, audit, entitlements);
  return {
    config,
    redis,
    audit,
    auth: new AuthService(config, redis, mail, audit),
    organizations: new OrganizationsService(audit, config.MAX_ORGS_PER_USER),
    members: new MembersService(audit),
    invitations: new InvitationsService(config, mail, audit, entitlements),
    entitlements,
    websites,
    ingest: new IngestService(redis, entitlements, websites),
    limiter: createRateLimiterFactory(redis, config.RATE_LIMIT_ENABLED),
  };
}
