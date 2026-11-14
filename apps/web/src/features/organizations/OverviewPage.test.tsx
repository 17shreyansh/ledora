import type { WebsiteDto } from '@ledora/shared';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { errorResponse, jsonResponse, mockApi, renderRoutes } from '../../test/utils';
import { makeOrg, makeUsage, makeWebsite, ORG_ID, session, verifiedInstallation, WEBSITE_ID } from '../../test/websiteFixtures';
import { OrgLayout } from './OrgLayout';
import { OverviewPage } from './OverviewPage';

const orgPath = `/orgs/${ORG_ID}`;

function setup(websites: WebsiteDto[] | 'error', usage: 'error' | 'ok' = 'ok') {
  mockApi({
    'GET /auth/session': () => jsonResponse(session),
    [`GET ${orgPath}`]: () => jsonResponse(makeOrg('manager')),
    [`GET ${orgPath}/members`]: () =>
      jsonResponse({ items: [{ userId: 'me', name: 'Morgan Me', email: 'me@example.com', role: 'manager', joinedAt: '2026-01-01T00:00:00.000Z' }], nextCursor: null }),
    [`GET ${orgPath}/websites`]: () =>
      websites === 'error' ? errorResponse(500, 'INTERNAL', 'Something broke') : jsonResponse(websites),
    [`GET ${orgPath}/usage`]: () =>
      usage === 'error' ? errorResponse(500, 'INTERNAL', 'Usage is unavailable') : jsonResponse(makeUsage(websites === 'error' ? 0 : websites.length)),
  });
  renderRoutes([{ path: '/o/:orgId', element: <OrgLayout />, children: [{ index: true, element: <OverviewPage /> }] }], `/o/${ORG_ID}`);
}

async function checklist() {
  const card = (await screen.findByRole('heading', { name: 'Getting started' })).closest('section')!;
  await within(card).findByText(/Add your first website/);
  return card;
}

/** The checklist item's title with its screen-reader status, e.g. "Add your first website (done)". */
function step(card: HTMLElement, title: string): string | undefined {
  const item = within(card)
    .getAllByRole('listitem')
    .find((li) => li.querySelector('p')?.textContent?.startsWith(title));
  return item?.querySelector('p')?.textContent ?? undefined;
}

describe('Overview getting started', () => {
  it('shows both website steps as to do when there are no websites', async () => {
    setup([]);
    const card = await checklist();
    expect(step(card, 'Add your first website')).toBe('Add your first website (to do)');
    expect(step(card, 'Install Ledora on your website')).toBe('Install Ledora on your website (to do)');
    expect(within(card).getByRole('link', { name: 'Add a website' })).toHaveAttribute('href', `/o/${ORG_ID}/websites?add=1`);
    expect(within(card).queryByRole('link', { name: 'View install steps' })).not.toBeInTheDocument();
  });

  it('links to the install tab once a website exists but is not verified', async () => {
    setup([makeWebsite()]);
    const card = await checklist();
    expect(step(card, 'Add your first website')).toBe('Add your first website (done)');
    expect(step(card, 'Install Ledora on your website')).toBe('Install Ledora on your website (to do)');
    expect(within(card).getByRole('link', { name: 'View install steps' })).toHaveAttribute(
      'href',
      `/o/${ORG_ID}/websites/${WEBSITE_ID}/install`,
    );
  });

  it('marks installation done when any website is verified', async () => {
    setup([makeWebsite({ installation: verifiedInstallation })]);
    const card = await checklist();
    expect(step(card, 'Add your first website')).toBe('Add your first website (done)');
    expect(step(card, 'Install Ledora on your website')).toBe('Install Ledora on your website (done)');
    expect(within(card).getByText('All done. Nice work.')).toBeInTheDocument();
  });

  it('leaves the website steps out rather than guessing when websites cannot be loaded', async () => {
    setup('error');
    const card = (await screen.findByRole('heading', { name: 'Getting started' })).closest('section')!;
    expect(await within(card).findByText('Couldn’t check your websites')).toBeInTheDocument();
    expect(within(card).queryByText(/Add your first website/)).not.toBeInTheDocument();
  });
});

describe('Overview plan usage', () => {
  it('shows the plan and real usage numbers', async () => {
    setup([makeWebsite()]);
    const card = (await screen.findByRole('heading', { name: 'Plan usage' })).closest('section')!;
    expect(await within(card).findByText(/Free plan/)).toBeInTheDocument();
    expect(within(card).getByText('1 of 3')).toBeInTheDocument();
    expect(within(card).getByText(`${(1234).toLocaleString()} of ${(10000).toLocaleString()}`)).toBeInTheDocument();
    expect(within(card).getByRole('progressbar', { name: 'Events this month' })).toHaveAttribute('aria-valuenow', '12');
    expect(within(card).getByText('2 of 3')).toBeInTheDocument();
  });

  it('shows an error when usage cannot be loaded', async () => {
    setup([], 'error');
    const card = (await screen.findByRole('heading', { name: 'Plan usage' })).closest('section')!;
    expect(await within(card).findByText('Couldn’t load plan usage')).toBeInTheDocument();
  });
});
