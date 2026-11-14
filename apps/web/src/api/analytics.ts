import type { AnalyticsOverviewDto, BreakdownDimension, BreakdownDto, DateRangePreset, RealtimeDto } from '@ledora/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from './client';
import { queryKeys } from './queryKeys';

/** How often the realtime card refreshes while the page is visible. */
export const REALTIME_REFETCH_MS = 15_000;

/** Number of rows a breakdown panel shows, and how many the "Show more" dialog asks for. */
export const BREAKDOWN_LIMIT = 10;
export const BREAKDOWN_LIMIT_EXPANDED = 100;

/** The parameters every range-scoped analytics request shares. */
export interface AnalyticsParams {
  /** null = all websites of the organization. */
  websiteId: string | null;
  range: DateRangePreset;
  /** Inclusive YYYY-MM-DD dates in the org's time zone; only sent for range=custom. */
  from?: string | undefined;
  to?: string | undefined;
  compare: boolean;
}

const orgPath = (orgId: string) => `/orgs/${encodeURIComponent(orgId)}`;

/**
 * Serializes parameters in a fixed key order and leaves out what doesn't apply, so equal filters
 * always produce the same string. The string is both the request's query and part of its cache key.
 */
export function serializeAnalyticsParams(
  params: Partial<AnalyticsParams> & { dimension?: BreakdownDimension; limit?: number },
  include: { range?: boolean; compare?: boolean } = { range: true, compare: true },
): string {
  const entries: Array<[string, string]> = [];
  if (params.dimension) entries.push(['dimension', params.dimension]);
  if (params.limit !== undefined) entries.push(['limit', String(params.limit)]);
  if (include.range && params.range) {
    entries.push(['range', params.range]);
    if (params.range === 'custom') {
      if (params.from) entries.push(['from', params.from]);
      if (params.to) entries.push(['to', params.to]);
    }
  }
  if (params.websiteId) entries.push(['websiteId', params.websiteId]);
  if (include.compare && params.compare !== undefined) entries.push(['compare', String(params.compare)]);
  return new URLSearchParams(entries).toString();
}

export const analyticsKeys = {
  all: (orgId: string) => [...queryKeys.org(orgId), 'analytics'] as const,
  overview: (orgId: string, query: string) => [...analyticsKeys.all(orgId), 'overview', query] as const,
  breakdown: (orgId: string, query: string) => [...analyticsKeys.all(orgId), 'breakdown', query] as const,
  realtime: (orgId: string, query: string) => [...analyticsKeys.all(orgId), 'realtime', query] as const,
};

export function useAnalyticsOverview(orgId: string, params: AnalyticsParams, { enabled = true }: { enabled?: boolean } = {}) {
  const query = serializeAnalyticsParams(params);
  return useQuery({
    queryKey: analyticsKeys.overview(orgId, query),
    queryFn: ({ signal }) => api.get<AnalyticsOverviewDto>(`${orgPath(orgId)}/analytics/overview?${query}`, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useAnalyticsBreakdown(
  orgId: string,
  params: AnalyticsParams,
  dimension: BreakdownDimension,
  { limit = BREAKDOWN_LIMIT, enabled = true }: { limit?: number; enabled?: boolean } = {},
) {
  // Breakdowns have no comparison, so `compare` stays out of the request and the cache key.
  const query = serializeAnalyticsParams({ ...params, dimension, limit }, { range: true, compare: false });
  return useQuery({
    queryKey: analyticsKeys.breakdown(orgId, query),
    queryFn: ({ signal }) => api.get<BreakdownDto>(`${orgPath(orgId)}/analytics/breakdown?${query}`, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useAnalyticsRealtime(
  orgId: string,
  websiteId: string | null,
  { enabled = true, pageVisible = true }: { enabled?: boolean; pageVisible?: boolean } = {},
) {
  const query = serializeAnalyticsParams({ websiteId }, { range: false, compare: false });
  return useQuery({
    queryKey: analyticsKeys.realtime(orgId, query),
    queryFn: ({ signal }) => api.get<RealtimeDto>(`${orgPath(orgId)}/analytics/realtime${query ? `?${query}` : ''}`, signal),
    // Only poll while someone can see the page; a hidden tab neither polls nor catches up in the background.
    refetchInterval: pageVisible ? REALTIME_REFETCH_MS : false,
    refetchIntervalInBackground: false,
    staleTime: 0,
    placeholderData: keepPreviousData,
    enabled,
  });
}
