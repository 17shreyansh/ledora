import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from './client';
import { queryKeys } from './queryKeys';

function isSessionExpired(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401 && error.code === 'UNAUTHENTICATED';
}

/**
 * Creates the app's QueryClient. A 401 from any request (other than the session probe itself)
 * means the session ended elsewhere — expired, revoked by a password change, or signed out in
 * another tab — so the session is cleared and the route guards send the user to sign in.
 */
export function createQueryClient(): QueryClient {
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (query.queryKey[0] !== queryKeys.session[0] && isSessionExpired(error)) {
          client.setQueryData(queryKeys.session, null);
        }
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        if (isSessionExpired(error)) client.setQueryData(queryKeys.session, null);
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Client errors (403/404/422…) will not fix themselves; only retry network/server errors.
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
          return failureCount < 2;
        },
      },
      mutations: { retry: false },
    },
  });
  return client;
}
