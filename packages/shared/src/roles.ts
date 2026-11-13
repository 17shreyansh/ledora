/**
 * Organization roles and permissions.
 *
 * This module is the single source of truth for authorization rules. The server
 * enforces it; the web app only uses it to decide what to *show*. Hiding a
 * control in the UI is never a security boundary.
 */

export const ORG_ROLES = ['owner', 'admin', 'manager', 'analyst', 'viewer'] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

/** Higher number = more privileged. Used for "may act on" comparisons. */
export const ROLE_RANK: Record<OrgRole, number> = {
  owner: 50,
  admin: 40,
  manager: 30,
  analyst: 20,
  viewer: 10,
};

export const ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  analyst: 'Analyst',
  viewer: 'Viewer',
};

export const ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  owner: 'Full control, including billing, ownership and deleting the organization.',
  admin: 'Manages team members, settings and integrations.',
  manager: 'Runs day-to-day work: websites, forms, chatbots, leads and conversations.',
  analyst: 'Reads analytics and leads and can export reports. Cannot change configuration.',
  viewer: 'Read-only access to dashboards and analytics. No access to lead contact details.',
};

export const PERMISSIONS = [
  'org.read',
  'org.update',
  'org.delete',
  'billing.manage',
  'members.read',
  'members.invite',
  'members.manage',
  'websites.read',
  'websites.manage',
  'analytics.read',
  'leads.read',
  'leads.manage',
  'reports.export',
  'conversations.read',
  'conversations.reply',
  'conversations.manage',
  'forms.manage',
  'chatbots.manage',
  'monitoring.manage',
  'automations.manage',
  'integrations.manage',
  'audit.read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const VIEWER: Permission[] = ['org.read', 'members.read', 'websites.read', 'analytics.read'];
const ANALYST: Permission[] = [...VIEWER, 'leads.read', 'reports.export', 'conversations.read'];
const MANAGER: Permission[] = [
  ...ANALYST,
  'websites.manage',
  'leads.manage',
  'conversations.reply',
  'conversations.manage',
  'forms.manage',
  'chatbots.manage',
  'monitoring.manage',
  'automations.manage',
];
const ADMIN: Permission[] = [
  ...MANAGER,
  'org.update',
  'members.invite',
  'members.manage',
  'integrations.manage',
  'audit.read',
];
const OWNER: Permission[] = [...ADMIN, 'org.delete', 'billing.manage'];

export const ROLE_PERMISSIONS: Record<OrgRole, ReadonlySet<Permission>> = {
  owner: new Set(OWNER),
  admin: new Set(ADMIN),
  manager: new Set(MANAGER),
  analyst: new Set(ANALYST),
  viewer: new Set(VIEWER),
};

export function isOrgRole(value: unknown): value is OrgRole {
  return typeof value === 'string' && (ORG_ROLES as readonly string[]).includes(value);
}

export function hasPermission(role: OrgRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

/**
 * Whether `actor` may grant `role` to someone (by invitation or role change).
 * Owners may grant any role. Everyone else may only grant roles strictly below their own.
 */
export function canGrantRole(actor: OrgRole, role: OrgRole): boolean {
  if (actor === 'owner') return true;
  return ROLE_RANK[actor] > ROLE_RANK[role];
}

/**
 * Whether `actor` may change or remove a member currently holding `target`.
 * Owners may act on anyone (subject to the last-owner rule enforced by the server).
 * Everyone else may only act on members strictly below their own role.
 */
export function canManageMember(actor: OrgRole, target: OrgRole): boolean {
  if (actor === 'owner') return true;
  return ROLE_RANK[actor] > ROLE_RANK[target];
}
