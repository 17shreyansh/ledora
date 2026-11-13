import type { ApiErrorBody, ErrorCode, SessionDto } from '@ledora/shared';

/** Error codes the client itself can produce in addition to the API's own codes. */
export type ClientErrorCode = ErrorCode | 'NETWORK_ERROR' | 'UNKNOWN';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ClientErrorCode;
  readonly fields: Record<string, string> | undefined;
  readonly requestId: string | undefined;

  constructor(init: {
    status: number;
    code: ClientErrorCode;
    message: string;
    fields?: Record<string, string> | undefined;
    requestId?: string | undefined;
  }) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.fields = init.fields;
    this.requestId = init.requestId;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export const API_URL: string = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1').replace(/\/+$/, '');

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/*
 * The CSRF synchronizer token lives in module memory only. It is never written to
 * localStorage/sessionStorage, so it disappears with the tab and cannot be read by
 * anything that only has access to storage.
 */
let csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

export function getCsrfToken(): string | null {
  return csrfToken;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  signal?: AbortSignal | undefined;
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const err = (value as { error: unknown }).error;
  return typeof err === 'object' && err !== null && 'code' in err && 'message' in err;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function fallbackMessage(status: number): string {
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  if (status >= 500) return 'Something went wrong on our side. Please try again.';
  return 'The request could not be completed.';
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (UNSAFE_METHODS.has(method) && csrfToken) headers['X-CSRF-Token'] = csrfToken;

  try {
    return await fetch(`${API_URL}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Could not reach Ledora. Check your connection and try again.',
    });
  }
}

let refreshing: Promise<void> | null = null;

/**
 * Re-reads the session to obtain a fresh CSRF token (for example after the session was
 * rotated in another tab). Concurrent callers share one request.
 */
export function refreshCsrfToken(): Promise<void> {
  refreshing ??= (async () => {
    try {
      const response = await send('/auth/session', { method: 'GET' });
      if (response.ok) {
        const session = (await readJson(response)) as SessionDto | undefined;
        setCsrfToken(session?.csrfToken ?? null);
      } else {
        setCsrfToken(null);
      }
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function toApiError(response: Response): Promise<ApiError> {
  const body = await readJson(response);
  if (isErrorBody(body)) {
    return new ApiError({
      status: response.status,
      code: body.error.code,
      message: body.error.message,
      fields: body.error.fields,
      requestId: body.error.requestId,
    });
  }
  return new ApiError({ status: response.status, code: 'UNKNOWN', message: fallbackMessage(response.status) });
}

/**
 * Calls the Ledora API. Always sends cookies, attaches the CSRF token to unsafe methods,
 * and — once — refreshes the session and retries when the server reports a stale CSRF token.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await send(path, options);

  if (response.status === 403 && UNSAFE_METHODS.has(options.method ?? 'GET')) {
    const error = await toApiError(response);
    if (error.code !== 'CSRF_FAILED') throw error;
    await refreshCsrfToken();
    response = await send(path, options);
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await readJson(response)) as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => apiRequest<T>(path, { method: 'GET', signal }),
  post: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'DELETE', body }),
};
