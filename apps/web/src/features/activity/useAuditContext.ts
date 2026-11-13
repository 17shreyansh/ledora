import { useMemo } from 'react';
import { useSession } from '../../api/auth';
import { useInvitations, useMembers } from '../../api/organizations';
import type { AuditContext } from '../../lib/auditSentence';
import { useCurrentOrg } from '../organizations/OrgContext';

/** Names and emails used to turn audit entries into sentences ("Ada changed Ben's role…"). */
export function useAuditContext(): AuditContext {
  const { org, can } = useCurrentOrg();
  const session = useSession();
  const members = useMembers(org.id);
  const invitations = useInvitations(org.id, can('members.invite'));

  return useMemo(() => {
    const memberNames = new Map<string, string>();
    for (const page of members.data?.pages ?? []) for (const m of page.items) memberNames.set(m.userId, m.name);
    const invitationEmails = new Map<string, string>();
    for (const inv of invitations.data ?? []) invitationEmails.set(inv.id, inv.email);
    return { currentUserId: session.data?.user.id ?? null, memberNames, invitationEmails };
  }, [members.data, invitations.data, session.data?.user.id]);
}
