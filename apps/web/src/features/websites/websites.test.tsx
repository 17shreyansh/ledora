import { MAX_ALLOWED_DOMAINS, type OrgRole, type UsageDto, type WebsiteDto } from '@ledora/shared';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { INSTALL_POLL_INTERVAL_MS } from '../../api/websites';
import { buildInstallSnippet } from '../../lib/sdkSnippet';
import { errorResponse, jsonResponse, mockApi, renderRoutes, type RecordedRequest } from '../../test/utils';
import {
  emptyStats,
  makeOrg,
  makeUsage,
  makeWebsite,
  ORG_ID,
  session,
  SITE_KEY,
  verifiedInstallation,
  WEBSITE_ID,
} from '../../test/websiteFixtures';
import { OrgLayout } from '../organizations/OrgLayout';
import { WebsiteDetailPage } from './WebsiteDetailPage';
import { WebsitesPage } from './WebsitesPage';

const orgPath = `/orgs/${ORG_ID}`;
const sitePath = `${orgPath}/websites/${WEBSITE_ID}`;

type Handler = (req: RecordedRequest) => Response | Promise<Response>;

function setup(
  role: OrgRole,
  path: string,
  {
    website = makeWebsite(),
    websites,
    usage = makeUsage(1),
    extra = {},
  }: { website?: WebsiteDto; websites?: WebsiteDto[]; usage?: UsageDto | (() => UsageDto); extra?: Record<string, Handler> } = {},
) {
  const api = mockApi({
    'GET /auth/session': () => jsonResponse(session),
    [`GET ${orgPath}`]: () => jsonResponse(makeOrg(role)),
    [`GET ${orgPath}/websites`]: () => jsonResponse(websites ?? [website]),
    [`GET ${orgPath}/usage`]: () => jsonResponse(typeof usage === 'function' ? usage() : usage),
    [`GET ${sitePath}`]: () => jsonResponse(website),
    [`GET ${sitePath}/stats`]: () => jsonResponse(emptyStats),
    ...extra,
  });
  const view = renderRoutes(
    [
      {
        path: '/o/:orgId',
        element: <OrgLayout />,
        children: [
          { path: 'websites', element: <WebsitesPage /> },
          { path: 'websites/:websiteId/:tab?', element: <WebsiteDetailPage /> },
        ],
      },
    ],
    path,
  );
  return { ...api, ...view };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('install snippet', () => {
  it('copies exactly the script tag with the site key', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    setup('viewer', `/o/${ORG_ID}/websites/${WEBSITE_ID}/install`);

    const expected = `<script src="http://localhost:4000/sdk/v1/widget.js" data-ledora-site="${SITE_KEY}" async></script>`;
    expect(await screen.findByTestId('install-snippet')).toHaveTextContent(expected);

    await user.click(screen.getByRole('button', { name: 'Copy snippet' }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(expected);
    expect(await navigator.clipboard.readText()).toBe(expected);
  });

  it('adds data-ledora-api only when a public API URL is configured', () => {
    expect(buildInstallSnippet(SITE_KEY, { sdkUrl: 'https://cdn.example.com/w.js', apiUrl: undefined })).toBe(
      `<script src="https://cdn.example.com/w.js" data-ledora-site="${SITE_KEY}" async></script>`,
    );
    expect(buildInstallSnippet(SITE_KEY, { sdkUrl: 'https://cdn.example.com/w.js', apiUrl: 'https://api.example.com' })).toBe(
      `<script src="https://cdn.example.com/w.js" data-ledora-site="${SITE_KEY}" data-ledora-api="https://api.example.com" async></script>`,
    );
  });
});

describe('installation verification', () => {
  it('polls while not installed and stops once the website is verified', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let websiteCalls = 0;
    const { requests } = setup('viewer', `/o/${ORG_ID}/websites/${WEBSITE_ID}/install`, {
      extra: {
        [`GET ${sitePath}`]: () => {
          websiteCalls += 1;
          // The server only reports "verified" after it has received a real event.
          return jsonResponse(makeWebsite(websiteCalls >= 3 ? { installation: verifiedInstallation } : {}));
        },
      },
    });

    expect(await screen.findByText('Waiting for the first visit')).toBeInTheDocument();
    expect(websiteCalls).toBe(1);

    await act(() => vi.advanceTimersByTimeAsync(INSTALL_POLL_INTERVAL_MS));
    expect(websiteCalls).toBe(2);
    expect(screen.getByText('Waiting for the first visit')).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(INSTALL_POLL_INTERVAL_MS));
    expect(websiteCalls).toBe(3);
    expect(await screen.findByText('Ledora is installed')).toBeInTheDocument();
    expect(screen.getByText(/SDK version 1\.0\.0/)).toBeInTheDocument();

    // No more polling once verified.
    await act(() => vi.advanceTimersByTimeAsync(INSTALL_POLL_INTERVAL_MS * 5));
    expect(websiteCalls).toBe(3);
    expect(requests.filter((r) => r.method === 'GET' && r.path === sitePath)).toHaveLength(3);
  });

  it('"Check now" re-reads the website and its stats', async () => {
    const user = userEvent.setup();
    const { requests } = setup('viewer', `/o/${ORG_ID}/websites/${WEBSITE_ID}/install`);
    await screen.findByText('Waiting for the first visit');
    const before = requests.length;
    await user.click(screen.getByRole('button', { name: 'Check now' }));
    const after = requests.slice(before).map((r) => r.path);
    expect(after).toContain(sitePath);
    expect(after).toContain(`${sitePath}/stats`);
    expect(await screen.findByText(/No visits yet\./)).toBeInTheDocument();
  });
});

describe('permissions', () => {
  it('hides add, rotate and delete controls from a viewer', async () => {
    setup('viewer', `/o/${ORG_ID}/websites`);
    expect(await screen.findByRole('link', { name: 'Acme Shop' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add website' })).not.toBeInTheDocument();
  });

  it('shows the viewer a read-only settings tab', async () => {
    setup('viewer', `/o/${ORG_ID}/websites/${WEBSITE_ID}/settings`);
    expect(await screen.findByText(SITE_KEY)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rotate key' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete website' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove / })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Add a domain' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Website name' })).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Ask visitors for consent before tracking' })).toBeDisabled();
  });

  it('shows add, rotate and delete controls to a manager', async () => {
    setup('manager', `/o/${ORG_ID}/websites`);
    expect(await screen.findByRole('button', { name: 'Add website' })).toBeEnabled();
    expect(await screen.findByText('1 of 3 websites')).toBeInTheDocument();
  });

  it('lets a manager rotate the key after a confirmation that warns about the snippet', async () => {
    const user = userEvent.setup();
    const rotated = makeWebsite({ siteKey: 'ldr_ZyXwVuTsRqPoNmLkJiHg' });
    const { requests } = setup('manager', `/o/${ORG_ID}/websites/${WEBSITE_ID}/settings`, {
      extra: { [`POST ${sitePath}/rotate-key`]: () => jsonResponse(rotated) },
    });
    expect(await screen.findByRole('button', { name: 'Delete website' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Rotate key' }));
    const dialog = await screen.findByRole('dialog', { name: 'Rotate the site key?' });
    expect(within(dialog).getByText(/stops working immediately/)).toBeInTheDocument();
    expect(within(dialog).getByText(/replace the snippet/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Rotate key' }));
    expect(await screen.findByText('ldr_ZyXwVuTsRqPoNmLkJiHg')).toBeInTheDocument();
    expect(requests.some((r) => r.method === 'POST' && r.path === `${sitePath}/rotate-key`)).toBe(true);
  });

  it('disables "Add website" with an explanation at the plan limit', async () => {
    setup('manager', `/o/${ORG_ID}/websites`, { usage: makeUsage(3) });
    expect(await screen.findByText('3 of 3 websites · plan limit reached')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add website' })).toBeDisabled();
  });
});

describe('allowed domains editor', () => {
  it('rejects invalid domains and accepts a wildcard', async () => {
    const user = userEvent.setup();
    const { requests } = setup('manager', `/o/${ORG_ID}/websites/${WEBSITE_ID}/settings`, {
      extra: {
        [`PATCH ${sitePath}`]: (req) =>
          jsonResponse(makeWebsite({ allowedDomains: (req.body as { allowedDomains: string[] }).allowedDomains })),
      },
    });
    const input = await screen.findByRole('textbox', { name: 'Add a domain' });

    await user.type(input, 'not a domain{Enter}');
    expect(await screen.findByText('Enter a domain like example.com or *.example.com')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Remove / })).toHaveLength(2);

    await user.clear(input);
    await user.type(input, 'https://Shop.Example.com/cart');
    await user.click(screen.getByRole('button', { name: 'Add domain' }));
    expect(await screen.findByText('shop.example.com is already in the list')).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, '*.Example.com{Enter}');
    expect(screen.getByRole('button', { name: 'Remove *.example.com' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save domains' }));
    const patch = requests.find((r) => r.method === 'PATCH');
    expect(patch?.body).toEqual({ allowedDomains: ['shop.example.com', 'www.shop.example.com', '*.example.com'] });
  });

  it(`rejects entry number ${MAX_ALLOWED_DOMAINS + 1}`, async () => {
    const user = userEvent.setup();
    const full = Array.from({ length: MAX_ALLOWED_DOMAINS }, (_, i) => `site${i + 1}.example.com`);
    setup('manager', `/o/${ORG_ID}/websites/${WEBSITE_ID}/settings`, { website: makeWebsite({ allowedDomains: full }) });
    const input = await screen.findByRole('textbox', { name: 'Add a domain' });
    expect(screen.getAllByRole('button', { name: /^Remove / })).toHaveLength(MAX_ALLOWED_DOMAINS);

    await user.type(input, 'one-more.example.com{Enter}');
    expect(await screen.findByText(/You can allow up to 20 domains/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Remove / })).toHaveLength(MAX_ALLOWED_DOMAINS);
    expect(screen.queryByText('one-more.example.com')).not.toBeInTheDocument();
  });
});

describe('adding a website', () => {
  it('shows the plan-limit message and current usage when the server refuses', async () => {
    const user = userEvent.setup();
    let usageCalls = 0;
    setup('manager', `/o/${ORG_ID}/websites`, {
      // The usage we loaded first is out of date; the server knows better and refuses.
      usage: () => makeUsage(++usageCalls === 1 ? 2 : 3),
      extra: {
        [`POST ${orgPath}/websites`]: () =>
          errorResponse(403, 'PLAN_LIMIT', 'Your plan allows up to 3 websites. Remove a website or upgrade to add more.'),
      },
    });

    await user.click(await screen.findByRole('button', { name: 'Add website' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a website' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Website name' }), 'Blog');
    await user.type(within(dialog).getByRole('textbox', { name: 'Website address' }), 'https://blog.example.com/');
    await user.click(within(dialog).getByRole('button', { name: 'Add website' }));

    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Your plan’s website limit is reached');
    expect(alert).toHaveTextContent('Your plan allows up to 3 websites.');
    expect(await within(dialog).findByText(/You’re using 3 of 3 websites on the Free plan\./)).toBeInTheDocument();
  });

  it('creates the website with a normalized domain and opens its install tab', async () => {
    const user = userEvent.setup();
    const created = makeWebsite({ id: 'new-site', name: 'Blog', domain: 'blog.example.com' });
    const { requests, router } = setup('manager', `/o/${ORG_ID}/websites`, {
      websites: [],
      extra: {
        [`POST ${orgPath}/websites`]: () => jsonResponse(created, 201),
        [`GET ${orgPath}/websites/new-site`]: () => jsonResponse(created),
        [`GET ${orgPath}/websites/new-site/stats`]: () => jsonResponse(emptyStats),
      },
    });

    expect(await screen.findByText('No websites yet')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add website' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a website' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Website name' }), 'Blog');
    await user.type(within(dialog).getByRole('textbox', { name: 'Website address' }), 'https://Blog.Example.com/news');
    expect(within(dialog).getByText('We’ll save this as blog.example.com')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Add website' }));

    expect(await screen.findByRole('heading', { name: 'Install Ledora on Blog' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/o/${ORG_ID}/websites/new-site/install`);
    expect(requests.find((r) => r.method === 'POST')?.body).toEqual({ name: 'Blog', domain: 'blog.example.com' });
  });
});
