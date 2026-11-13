import type {
  AuditLogDto,
  InvitationDto,
  InvitationPreviewDto,
  MemberDto,
  OrganizationDto,
  OrganizationWithRoleDto,
  OrgRole,
  Paginated,
} from '@ledora/shared';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { queryKeys } from './queryKeys';

const orgPath = (orgId: string) => `/orgs/${encodeURIComponent(orgId)}`;

// ── Organizations ──────────────────────────────────────────────────────────

export function useOrganization(orgId: string) {
  return useQuery({
    queryKey: queryKeys.orgDetail(orgId),
    queryFn: ({ signal }) => api.get<OrganizationWithRoleDto>(orgPath(orgId), signal),
  });
}

export interface CreateOrganizationBody {
  name: string;
  slug?: string | undefined;
  timezone: string;
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateOrganizationBody) => api.post<OrganizationWithRoleDto>('/orgs', body),
    onSuccess: (org) => {
      queryClient.setQueryData(queryKeys.orgDetail(org.id), org);
      void queryClient.invalidateQueries({ queryKey: queryKeys.myOrganizations });
    },
  });
}

export interface UpdateOrganizationBody {
  name?: string;
  slug?: string;
  timezone?: string;
}

export function useUpdateOrganization(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateOrganizationBody) => api.patch<OrganizationWithRoleDto>(orgPath(orgId), body),
    onSuccess: (org) => {
      queryClient.setQueryData(queryKeys.orgDetail(orgId), org);
      void queryClient.invalidateQueries({ queryKey: queryKeys.myOrganizations });
      void queryClient.invalidateQueries({ queryKey: queryKeys.auditLogs(orgId) });
    },
  });
}

export function useDeleteOrganization(orgId: string) {
  return useMutation({
    mutationFn: (confirmName: string) => api.delete<void>(orgPath(orgId), { confirmName }),
  });
}

// ── Members ────────────────────────────────────────────────────────────────

export function useMembers(orgId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.members(orgId),
    queryFn: ({ pageParam, signal }) =>
      api.get<Paginated<MemberDto>>(
        `${orgPath(orgId)}/members${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`,
        signal,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
}

export function useUpdateMemberRole(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: OrgRole }) =>
      api.patch<MemberDto>(`${orgPath(orgId)}/members/${encodeURIComponent(userId)}`, { role }),
    onSuccess: () => {
      // My own role may have changed too (owners can step down), so refresh the whole org.
      void queryClient.invalidateQueries({ queryKey: queryKeys.org(orgId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.myOrganizations });
    },
  });
}

export function useRemoveMember(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.delete<void>(`${orgPath(orgId)}/members/${encodeURIComponent(userId)}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.members(orgId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.auditLogs(orgId) });
    },
  });
}

/** Leaving uses the same endpoint as removing, with my own user id. */
export function useLeaveOrganization(orgId: string) {
  return useMutation({
    mutationFn: (myUserId: string) => api.delete<void>(`${orgPath(orgId)}/members/${encodeURIComponent(myUserId)}`),
  });
}

// ── Invitations ────────────────────────────────────────────────────────────

export function useInvitations(orgId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.invitations(orgId),
    queryFn: ({ signal }) => api.get<InvitationDto[]>(`${orgPath(orgId)}/invitations`, signal),
    enabled,
  });
}

export function useCreateInvitation(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; role: OrgRole }) => api.post<InvitationDto>(`${orgPath(orgId)}/invitations`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.invitations(orgId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.auditLogs(orgId) });
    },
  });
}

export function useRevokeInvitation(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) =>
      api.delete<void>(`${orgPath(orgId)}/invitations/${encodeURIComponent(invitationId)}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.invitations(orgId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.auditLogs(orgId) });
    },
  });
}

/** The token travels in the request body (never a query string) so it stays out of logs. */
export function useInvitationPreview(token: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.invitationPreview(token),
    queryFn: () => api.post<InvitationPreviewDto>('/invitations/preview', { token }),
    enabled: enabled && token.length > 0,
    retry: false,
    staleTime: 60_000,
  });
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => api.post<{ organization: OrganizationDto }>('/invitations/accept', { token }),
    onSuccess: ({ organization }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.myOrganizations });
      void queryClient.invalidateQueries({ queryKey: queryKeys.org(organization.id) });
    },
  });
}

// ── Audit log ──────────────────────────────────────────────────────────────

export function useAuditLogs(orgId: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: queryKeys.auditLogs(orgId),
    queryFn: ({ pageParam, signal }) =>
      api.get<Paginated<AuditLogDto>>(
        `${orgPath(orgId)}/audit-logs${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`,
        signal,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled,
  });
}
