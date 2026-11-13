/**
 * Query-key factory. Every org-scoped key starts with ['orgs', orgId] so that one
 * `invalidateQueries({ queryKey: queryKeys.org(orgId) })` refreshes the whole organization.
 */
export const queryKeys = {
  session: ['session'] as const,
  me: ['me'] as const,
  myOrganizations: ['me', 'organizations'] as const,
  org: (orgId: string) => ['orgs', orgId] as const,
  orgDetail: (orgId: string) => ['orgs', orgId, 'detail'] as const,
  members: (orgId: string) => ['orgs', orgId, 'members'] as const,
  invitations: (orgId: string) => ['orgs', orgId, 'invitations'] as const,
  auditLogs: (orgId: string) => ['orgs', orgId, 'audit-logs'] as const,
  invitationPreview: (token: string) => ['invitation-preview', token] as const,
  emailVerification: (token: string) => ['email-verification', token] as const,
};
