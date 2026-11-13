import { describe, expect, it } from 'vitest';
import { canGrantRole, canManageMember, hasPermission, ORG_ROLES, ROLE_PERMISSIONS } from './roles.js';

describe('role permissions', () => {
  it('is strictly cumulative: each role holds every permission of the roles below it', () => {
    const ordered = [...ORG_ROLES].reverse(); // viewer → owner
    for (let i = 1; i < ordered.length; i++) {
      const lower = ROLE_PERMISSIONS[ordered[i - 1]!];
      const higher = ROLE_PERMISSIONS[ordered[i]!];
      for (const p of lower) expect(higher.has(p), `${ordered[i]} should have ${p}`).toBe(true);
    }
  });

  it('keeps lead contact details away from viewers', () => {
    expect(hasPermission('viewer', 'leads.read')).toBe(false);
    expect(hasPermission('analyst', 'leads.read')).toBe(true);
  });

  it('reserves destructive org actions for owners', () => {
    expect(hasPermission('admin', 'org.delete')).toBe(false);
    expect(hasPermission('admin', 'billing.manage')).toBe(false);
    expect(hasPermission('owner', 'org.delete')).toBe(true);
  });
});

describe('role grants', () => {
  it('lets owners grant any role', () => {
    for (const r of ORG_ROLES) expect(canGrantRole('owner', r)).toBe(true);
  });
  it('prevents admins from creating admins or owners', () => {
    expect(canGrantRole('admin', 'owner')).toBe(false);
    expect(canGrantRole('admin', 'admin')).toBe(false);
    expect(canGrantRole('admin', 'manager')).toBe(true);
  });
  it('prevents admins from managing peers or owners', () => {
    expect(canManageMember('admin', 'admin')).toBe(false);
    expect(canManageMember('admin', 'owner')).toBe(false);
    expect(canManageMember('admin', 'viewer')).toBe(true);
  });
});
