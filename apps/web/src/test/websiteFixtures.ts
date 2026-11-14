import type { OrganizationWithRoleDto, OrgRole, SessionDto, UsageDto, WebsiteDto, WebsiteStatsDto } from '@ledora/shared';

export const ORG_ID = '6af78aa30173e8d593472ac1';
export const WEBSITE_ID = '6af78aa30173e8d593472b01';
export const SITE_KEY = 'ldr_AbCdEfGhIjKlMnOpQrSt';

export const session: SessionDto = {
  user: { id: 'me', email: 'me@example.com', name: 'Morgan Me', emailVerified: true, createdAt: '2026-01-01T00:00:00.000Z' },
  csrfToken: 'csrf',
};

export function makeOrg(role: OrgRole): OrganizationWithRoleDto {
  return { id: ORG_ID, name: 'Acme', slug: 'acme', timezone: 'UTC', createdAt: '2026-01-01T00:00:00.000Z', role };
}

export function makeWebsite(overrides: Partial<WebsiteDto> = {}): WebsiteDto {
  return {
    id: WEBSITE_ID,
    name: 'Acme Shop',
    domain: 'shop.example.com',
    allowedDomains: ['shop.example.com', 'www.shop.example.com'],
    siteKey: SITE_KEY,
    tracking: { consentRequired: false, respectDoNotTrack: false },
    installation: { status: 'not_installed', firstSeenAt: null, lastSeenAt: null, sdkVersion: null },
    createdAt: '2026-11-01T10:00:00.000Z',
    ...overrides,
  };
}

export const verifiedInstallation: WebsiteDto['installation'] = {
  status: 'verified',
  firstSeenAt: '2026-11-10T09:30:00.000Z',
  lastSeenAt: '2026-11-10T09:45:00.000Z',
  sdkVersion: '1.0.0',
};

export function makeUsage(websitesUsed: number, websitesLimit = 3): UsageDto {
  return {
    period: '2026-11',
    plan: { key: 'free', name: 'Free' },
    limits: { websites: websitesLimit, monthlyEvents: 10_000, analyticsRetentionDays: 30, teamMembers: 3 },
    usage: { websites: websitesUsed, monthlyEvents: 1_234, teamMembers: 2 },
  };
}

export const emptyStats: WebsiteStatsDto = { eventsLast24h: 0, pageviewsLast24h: 0, lastEventAt: null };
