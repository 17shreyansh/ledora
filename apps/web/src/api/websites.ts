import type { UpdateWebsiteInput, UsageDto, WebsiteDto, WebsiteStatsDto } from '@ledora/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from './client';
import { queryKeys } from './queryKeys';

const orgPath = (orgId: string) => `/orgs/${encodeURIComponent(orgId)}`;
const websitePath = (orgId: string, websiteId: string) => `${orgPath(orgId)}/websites/${encodeURIComponent(websiteId)}`;

/** How often the install screen re-checks a website that has not been verified yet. */
export const INSTALL_POLL_INTERVAL_MS = 5_000;

/** Writes a fresh website into the detail cache and the list cache, so every screen agrees. */
function storeWebsite(queryClient: QueryClient, orgId: string, website: WebsiteDto): void {
  queryClient.setQueryData(queryKeys.website(orgId, website.id), website);
  queryClient.setQueryData<WebsiteDto[]>(queryKeys.websites(orgId), (list) =>
    list ? list.map((w) => (w.id === website.id ? website : w)) : list,
  );
}

// ── Usage ──────────────────────────────────────────────────────────────────

export function useUsage(orgId: string) {
  return useQuery({
    queryKey: queryKeys.usage(orgId),
    queryFn: ({ signal }) => api.get<UsageDto>(`${orgPath(orgId)}/usage`, signal),
  });
}

// ── Websites ───────────────────────────────────────────────────────────────

export function useWebsites(orgId: string) {
  return useQuery({
    queryKey: queryKeys.websites(orgId),
    queryFn: ({ signal }) => api.get<WebsiteDto[]>(`${orgPath(orgId)}/websites`, signal),
  });
}

export interface UseWebsiteOptions {
  /**
   * Re-fetch every few seconds while the website is still `not_installed`. Polling stops on its
   * own once the server reports `verified`, and TanStack Query pauses it while the browser tab is
   * hidden (`refetchIntervalInBackground` is off).
   */
  pollUntilVerified?: boolean;
}

export function useWebsite(orgId: string, websiteId: string, { pollUntilVerified = false }: UseWebsiteOptions = {}) {
  return useQuery({
    queryKey: queryKeys.website(orgId, websiteId),
    queryFn: ({ signal }) => api.get<WebsiteDto>(websitePath(orgId, websiteId), signal),
    refetchInterval: (query) =>
      pollUntilVerified && query.state.data?.installation.status === 'not_installed' ? INSTALL_POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
  });
}

export function useWebsiteStats(orgId: string, websiteId: string, options: { refetchInterval?: number | false } = {}) {
  return useQuery({
    queryKey: queryKeys.websiteStats(orgId, websiteId),
    queryFn: ({ signal }) => api.get<WebsiteStatsDto>(`${websitePath(orgId, websiteId)}/stats`, signal),
    refetchInterval: options.refetchInterval ?? false,
    refetchIntervalInBackground: false,
  });
}

export function useCreateWebsite(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; domain: string }) => api.post<WebsiteDto>(`${orgPath(orgId)}/websites`, body),
    onSuccess: (website) => {
      queryClient.setQueryData(queryKeys.website(orgId, website.id), website);
      void queryClient.invalidateQueries({ queryKey: queryKeys.websites(orgId), exact: true });
      void queryClient.invalidateQueries({ queryKey: queryKeys.usage(orgId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.auditLogs(orgId) });
    },
    onError: () => {
      // A plan-limit refusal usually means our usage numbers are out of date.
      void queryClient.invalidateQueries({ queryKey: queryKeys.usage(orgId) });
    },
  });
}

export function useUpdateWebsite(orgId: string, websiteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateWebsiteInput) => api.patch<WebsiteDto>(websitePath(orgId, websiteId), body),
    onSuccess: (website) => {
      storeWebsite(queryClient, orgId, website);
      void queryClient.invalidateQueries({ queryKey: queryKeys.auditLogs(orgId) });
    },
  });
}

export function useRotateSiteKey(orgId: string, websiteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<WebsiteDto>(`${websitePath(orgId, websiteId)}/rotate-key`),
    onSuccess: (website) => {
      storeWebsite(queryClient, orgId, website);
      void queryClient.invalidateQueries({ queryKey: queryKeys.auditLogs(orgId) });
    },
  });
}

export function useDeleteWebsite(orgId: string, websiteId: string) {
  return useMutation({
    mutationFn: (confirmName: string) => api.delete<void>(websitePath(orgId, websiteId), { confirmName }),
  });
}

/** Forgets a deleted website and refreshes everything that counted it. */
export function forgetWebsite(queryClient: QueryClient, orgId: string, websiteId: string): void {
  queryClient.removeQueries({ queryKey: queryKeys.website(orgId, websiteId) });
  queryClient.setQueryData<WebsiteDto[]>(queryKeys.websites(orgId), (list) => list?.filter((w) => w.id !== websiteId));
  void queryClient.invalidateQueries({ queryKey: queryKeys.websites(orgId), exact: true });
  void queryClient.invalidateQueries({ queryKey: queryKeys.usage(orgId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.auditLogs(orgId) });
}
