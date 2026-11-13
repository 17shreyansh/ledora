import { hasPermission, type OrganizationWithRoleDto, type OrgRole, type Permission } from '@ledora/shared';
import { createContext, useContext } from 'react';

export interface OrgContextValue {
  org: OrganizationWithRoleDto;
  role: OrgRole;
  can: (permission: Permission) => boolean;
}

export const OrgContext = createContext<OrgContextValue | null>(null);

export function makeOrgContext(org: OrganizationWithRoleDto): OrgContextValue {
  return { org, role: org.role, can: (permission) => hasPermission(org.role, permission) };
}

/** The organization of the current `/o/:orgId` route, with the viewer's role. */
export function useCurrentOrg(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error('useCurrentOrg must be used inside an organization route');
  return ctx;
}
