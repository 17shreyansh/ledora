import type { OrgRole } from './roles.js';

/** Response shapes shared by the API and the web app. Dates are ISO-8601 strings. */

export interface UserDto {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: string;
}

export interface SessionDto {
  user: UserDto;
  /** Synchronizer token; send as `X-CSRF-Token` on state-changing requests. */
  csrfToken: string;
}

export interface OrganizationDto {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  createdAt: string;
}

export interface OrganizationWithRoleDto extends OrganizationDto {
  role: OrgRole;
}

export interface MemberDto {
  userId: string;
  name: string;
  email: string;
  role: OrgRole;
  joinedAt: string;
}

export interface InvitationDto {
  id: string;
  email: string;
  role: OrgRole;
  invitedBy: { id: string; name: string } | null;
  expiresAt: string;
  createdAt: string;
}

export interface InvitationPreviewDto {
  organizationName: string;
  email: string;
  role: OrgRole;
  expiresAt: string;
}

export interface AuditLogDto {
  id: string;
  action: string;
  actor: { type: 'user' | 'system'; id: string | null; name: string | null };
  target: { type: string; id: string | null } | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

export type InstallationStatus = 'not_installed' | 'verified';

export interface WebsiteDto {
  id: string;
  name: string;
  domain: string;
  allowedDomains: string[];
  /** Public identifier used by the SDK snippet. Not a secret. */
  siteKey: string;
  tracking: { consentRequired: boolean; respectDoNotTrack: boolean };
  installation: {
    status: InstallationStatus;
    firstSeenAt: string | null;
    lastSeenAt: string | null;
    sdkVersion: string | null;
  };
  createdAt: string;
}

export interface WebsiteStatsDto {
  /** Events stored in the last 24 hours (accepted, de-duplicated, bots excluded). */
  eventsLast24h: number;
  pageviewsLast24h: number;
  lastEventAt: string | null;
}

export interface UsageDto {
  /** Calendar month in UTC, e.g. "2026-11". */
  period: string;
  plan: { key: string; name: string };
  limits: { websites: number; monthlyEvents: number; analyticsRetentionDays: number; teamMembers: number };
  usage: { websites: number; monthlyEvents: number; teamMembers: number };
}
