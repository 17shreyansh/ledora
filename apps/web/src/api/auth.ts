import type {
  LoginInput,
  OrganizationWithRoleDto,
  RegisterInput,
  SessionDto,
  UserDto,
} from '@ledora/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { clearSignedOut, markSignedOut } from '../auth/signOutState';
import { clearLastOrgId } from '../lib/lastOrg';
import { api, ApiError, setCsrfToken } from './client';
import { queryKeys } from './queryKeys';

export async function fetchSession(): Promise<SessionDto | null> {
  try {
    const session = await api.get<SessionDto>('/auth/session');
    setCsrfToken(session.csrfToken);
    return session;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      setCsrfToken(null);
      return null;
    }
    throw error;
  }
}

export function useSession() {
  return useQuery({
    queryKey: queryKeys.session,
    queryFn: fetchSession,
    staleTime: 5 * 60_000,
    retry: (count, error) => !(error instanceof ApiError && error.status > 0 && error.status < 500) && count < 2,
  });
}

/** Stores a freshly issued session: CSRF token in memory, user in the query cache. */
export function applySession(queryClient: QueryClient, session: SessionDto): void {
  setCsrfToken(session.csrfToken);
  clearSignedOut();
  // Anything cached for a previous user must not leak into this one.
  queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== queryKeys.session[0] });
  queryClient.setQueryData(queryKeys.session, session);
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => api.post<SessionDto>('/auth/login', input),
    onSuccess: (session) => applySession(queryClient, session),
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) => api.post<SessionDto>('/auth/register', input),
    onSuccess: (session) => applySession(queryClient, session),
  });
}

/** Signs out locally even if the network call fails: the user asked to leave. */
export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<void>('/auth/logout'),
    onSettled: () => {
      markSignedOut();
      setCsrfToken(null);
      clearLastOrgId();
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== queryKeys.session[0] });
      queryClient.setQueryData(queryKeys.session, null);
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (input: { email: string }) => api.post<{ ok: true }>('/auth/forgot-password', input),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (input: { token: string; password: string }) => api.post<void>('/auth/reset-password', input),
  });
}

export function useResendVerification() {
  return useMutation({
    mutationFn: () => api.post<{ ok: true }>('/auth/resend-verification'),
  });
}

/**
 * Verification consumes a one-time token, so it is modelled as a query: TanStack Query
 * de-duplicates the request (React StrictMode mounts effects twice) and caches the result.
 */
export function useVerifyEmail(token: string, enabled: boolean) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.emailVerification(token),
    queryFn: async () => {
      await api.post<void>('/auth/verify-email', { token });
      await queryClient.invalidateQueries({ queryKey: queryKeys.session });
      return true as const;
    },
    enabled: enabled && token.length > 0,
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string }) => api.patch<UserDto>('/me', input),
    onSuccess: (user) => {
      queryClient.setQueryData<SessionDto | null>(queryKeys.session, (prev) => (prev ? { ...prev, user } : prev));
      // Member lists show names.
      void queryClient.invalidateQueries({ queryKey: ['orgs'] });
    },
  });
}

export function useChangePassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) =>
      api.post<{ csrfToken: string }>('/me/password', input),
    onSuccess: ({ csrfToken }) => {
      // The server rotated the session; the old CSRF token is no longer valid.
      setCsrfToken(csrfToken);
      queryClient.setQueryData<SessionDto | null>(queryKeys.session, (prev) => (prev ? { ...prev, csrfToken } : prev));
    },
  });
}

export function useMyOrganizations(enabled = true) {
  return useQuery({
    queryKey: queryKeys.myOrganizations,
    queryFn: ({ signal }) => api.get<OrganizationWithRoleDto[]>('/me/organizations', signal),
    enabled,
  });
}
