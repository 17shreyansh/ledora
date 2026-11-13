import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';
import { vi, type Mock } from 'vitest';
import { AppProviders } from '../App';
import { API_URL } from '../api/client';
import { createQueryClient } from '../api/queryClient';

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function errorResponse(status: number, code: string, message: string, fields?: Record<string, string>): Response {
  return jsonResponse({ error: { code, message, ...(fields ? { fields } : {}), requestId: 'req-test-1' } }, status);
}

export interface RecordedRequest {
  method: string;
  path: string;
  headers: Headers;
  body: unknown;
  credentials: RequestCredentials | undefined;
}

type Handler = (req: RecordedRequest) => Response | Promise<Response>;

/**
 * Replaces global fetch with a router over "METHOD /path" keys (path relative to the API base,
 * query string included). Unhandled requests fail the test loudly.
 */
export function mockApi(handlers: Record<string, Handler>): { fetch: Mock; requests: RecordedRequest[] } {
  const requests: RecordedRequest[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? 'GET').toUpperCase();
    const path = url.startsWith(API_URL) ? url.slice(API_URL.length) : url;
    const req: RecordedRequest = {
      method,
      path,
      headers: new Headers(init?.headers),
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
      credentials: init?.credentials,
    };
    requests.push(req);
    const handler = handlers[`${method} ${path}`];
    if (!handler) throw new Error(`Unhandled request in test: ${method} ${path}`);
    return handler(req);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetch: fetchMock, requests };
}

export function renderRoutes(routes: RouteObject[], initialPath: string) {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false, staleTime: Infinity } });
  const view = render(
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { ...view, router, queryClient };
}

export function renderPage(element: ReactElement, path = '/') {
  return renderRoutes([{ path: '*', element }], path);
}
