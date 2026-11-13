import { describe, expect, it } from 'vitest';
import { errorResponse, jsonResponse, mockApi } from '../test/utils';
import { api, ApiError, getCsrfToken, setCsrfToken } from './client';

const session = (csrfToken: string) => ({
  user: { id: 'u1', email: 'ada@example.com', name: 'Ada', emailVerified: true, createdAt: '2026-01-01T00:00:00.000Z' },
  csrfToken,
});

describe('api client', () => {
  it('sends cookies on every request and the CSRF token only on unsafe methods', async () => {
    setCsrfToken('token-1');
    const { requests } = mockApi({
      'GET /me': () => jsonResponse({ id: 'u1' }),
      'POST /orgs': () => jsonResponse({ id: 'o1' }, 201),
      'PATCH /me': () => jsonResponse({ id: 'u1' }),
      'DELETE /orgs/o1/invitations/i1': () => jsonResponse(null, 204),
    });

    await api.get('/me');
    await api.post('/orgs', { name: 'Acme' });
    await api.patch('/me', { name: 'Ada' });
    await api.delete('/orgs/o1/invitations/i1');

    expect(requests.map((r) => r.credentials)).toEqual(['include', 'include', 'include', 'include']);
    const [get, post, patch, del] = requests;
    expect(get!.headers.get('X-CSRF-Token')).toBeNull();
    expect(post!.headers.get('X-CSRF-Token')).toBe('token-1');
    expect(post!.headers.get('Content-Type')).toBe('application/json');
    expect(post!.body).toEqual({ name: 'Acme' });
    expect(patch!.headers.get('X-CSRF-Token')).toBe('token-1');
    expect(del!.headers.get('X-CSRF-Token')).toBe('token-1');
  });

  it('refetches the session once and retries once after CSRF_FAILED', async () => {
    setCsrfToken('stale');
    let posts = 0;
    const { requests } = mockApi({
      'POST /orgs': (req) => {
        posts += 1;
        if (req.headers.get('X-CSRF-Token') === 'fresh') return jsonResponse({ id: 'o1' }, 201);
        return errorResponse(403, 'CSRF_FAILED', 'Your session token is missing or stale.');
      },
      'GET /auth/session': () => jsonResponse(session('fresh')),
    });

    await expect(api.post('/orgs', { name: 'Acme' })).resolves.toEqual({ id: 'o1' });
    expect(posts).toBe(2);
    expect(requests.map((r) => `${r.method} ${r.path}`)).toEqual(['POST /orgs', 'GET /auth/session', 'POST /orgs']);
    expect(requests[2]!.headers.get('X-CSRF-Token')).toBe('fresh');
    expect(getCsrfToken()).toBe('fresh');
  });

  it('does not retry more than once', async () => {
    setCsrfToken('stale');
    const { requests } = mockApi({
      'POST /orgs': () => errorResponse(403, 'CSRF_FAILED', 'Your session token is missing or stale.'),
      'GET /auth/session': () => jsonResponse(session('still-bad')),
    });

    const error = await api.post('/orgs', { name: 'Acme' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('CSRF_FAILED');
    expect(requests).toHaveLength(3);
  });

  it('does not retry other 403 errors', async () => {
    setCsrfToken('t');
    const { requests } = mockApi({
      'DELETE /orgs/o1': () => errorResponse(403, 'FORBIDDEN', 'You do not have permission to do that'),
    });
    await expect(api.delete('/orgs/o1', { confirmName: 'x' })).rejects.toMatchObject({ code: 'FORBIDDEN', status: 403 });
    expect(requests).toHaveLength(1);
  });

  it('turns error bodies into ApiError with fields and request id', async () => {
    mockApi({
      'POST /auth/register': () =>
        errorResponse(409, 'CONFLICT', 'An account with this email already exists', { email: 'Already registered' }),
    });
    const error = (await api.post('/auth/register', {}).catch((e: unknown) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(409);
    expect(error.code).toBe('CONFLICT');
    expect(error.fields).toEqual({ email: 'Already registered' });
    expect(error.requestId).toBe('req-test-1');
  });

  it('reports network failures as NETWORK_ERROR', async () => {
    mockApi({ 'GET /me': () => Promise.reject(new TypeError('Failed to fetch')) });
    await expect(api.get('/me')).rejects.toMatchObject({ code: 'NETWORK_ERROR', status: 0 });
  });
});
