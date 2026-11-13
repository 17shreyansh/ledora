import type { MemberDto, OrganizationWithRoleDto, OrgRole, SessionDto } from '@ledora/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { jsonResponse, mockApi, renderRoutes } from '../../test/utils';
import { OrgLayout } from '../organizations/OrgLayout';
import { MembersPage } from './MembersPage';

const ORG_ID = '6af78aa30173e8d593472ac1';

const session: SessionDto = {
  user: { id: 'me', email: 'me@example.com', name: 'Morgan Me', emailVerified: true, createdAt: '2026-01-01T00:00:00.000Z' },
  csrfToken: 'csrf',
};

const members: MemberDto[] = [
  { userId: 'owner', name: 'Olive Owner', email: 'olive@example.com', role: 'owner', joinedAt: '2026-01-01T00:00:00.000Z' },
  { userId: 'me', name: 'Morgan Me', email: 'me@example.com', role: 'viewer', joinedAt: '2026-01-02T00:00:00.000Z' },
  { userId: 'bob', name: 'Bob Viewer', email: 'bob@example.com', role: 'viewer', joinedAt: '2026-01-03T00:00:00.000Z' },
];

function setup(myRole: OrgRole) {
  const org: OrganizationWithRoleDto = {
    id: ORG_ID,
    name: 'Acme',
    slug: 'acme',
    timezone: 'UTC',
    createdAt: '2026-01-01T00:00:00.000Z',
    role: myRole,
  };
  const withMyRole = members.map((m) => (m.userId === 'me' ? { ...m, role: myRole } : m));
  const api = mockApi({
    'GET /auth/session': () => jsonResponse(session),
    [`GET /orgs/${ORG_ID}`]: () => jsonResponse(org),
    [`GET /orgs/${ORG_ID}/members`]: () => jsonResponse({ items: withMyRole, nextCursor: null }),
    [`GET /orgs/${ORG_ID}/invitations`]: () => jsonResponse([]),
  });
  renderRoutes(
    [{ path: '/o/:orgId', element: <OrgLayout />, children: [{ path: 'members', element: <MembersPage /> }] }],
    `/o/${ORG_ID}/members`,
  );
  return api;
}

describe('MembersPage permissions', () => {
  it('hides invite and role controls from a viewer', async () => {
    const { requests } = setup('viewer');

    expect(await screen.findByText('Bob Viewer')).toBeInTheDocument();
    expect(screen.getByText('Olive Owner')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Invite member' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Actions for Bob Viewer' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Actions for Olive Owner' })).not.toBeInTheDocument();
    expect(screen.queryByText('Pending invitations')).not.toBeInTheDocument();
    // Viewers lack members.invite, so the invitations endpoint is never called.
    expect(requests.some((r) => r.path.endsWith('/invitations'))).toBe(false);

    // A viewer can still leave the organization themselves.
    await userEvent.click(screen.getByRole('button', { name: 'Actions for Morgan Me' }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Leave organization' })).toBeInTheDocument();
    expect(within(menu).queryByRole('menuitem', { name: /Change/ })).not.toBeInTheDocument();
  });

  it('shows invite and role controls to an admin, limited to what an admin may manage', async () => {
    setup('admin');
    const user = userEvent.setup();

    expect(await screen.findByText('Bob Viewer')).toBeInTheDocument();
    expect(await screen.findByText('No pending invitations')).toBeInTheDocument();
    // An admin may manage the viewer, but not the owner.
    expect(screen.getByRole('button', { name: 'Actions for Bob Viewer' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Actions for Olive Owner' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Actions for Bob Viewer' }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Change role' })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: 'Remove from organization' })).toBeInTheDocument();
    await user.keyboard('{Escape}');

    // The invite dialog only offers roles an admin may grant.
    await user.click(screen.getAllByRole('button', { name: 'Invite member' })[0]!);
    const dialog = await screen.findByRole('dialog', { name: 'Invite a teammate' });
    await user.click(within(dialog).getByRole('combobox', { name: 'Role' }));
    const listbox = await screen.findByRole('listbox');
    const options = within(listbox)
      .getAllByRole('option')
      .map((o) => o.querySelector('p')?.textContent);
    expect(options).toEqual(['Manager', 'Analyst', 'Viewer']);
  });
});
