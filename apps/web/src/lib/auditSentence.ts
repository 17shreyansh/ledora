import { isOrgRole, ROLE_LABELS, type AuditLogDto } from '@ledora/shared';
import { possessive } from './format';

/** A sentence as segments; `strong` segments are names and roles rendered with emphasis. */
export type SentencePart = string | { strong: string };

export interface AuditContext {
  currentUserId: string | null;
  /** userId → display name, from the members list. */
  memberNames: ReadonlyMap<string, string>;
  /** invitationId → email, from the pending invitations list (if the viewer may see it). */
  invitationEmails?: ReadonlyMap<string, string>;
  /** invitationId → name of the person who accepted it, from `invitation.accepted` entries. */
  invitationAcceptedBy?: ReadonlyMap<string, string>;
}

/** Adds who accepted each invitation, so "invited someone" can name the person who joined. */
export function withAcceptedInvitations(ctx: AuditContext, entries: readonly AuditLogDto[]): AuditContext {
  const acceptedBy = new Map<string, string>();
  for (const e of entries) {
    if (e.action === 'invitation.accepted' && e.target?.id && e.actor.name) {
      acceptedBy.set(e.target.id, e.actor.id === ctx.currentUserId ? 'you' : e.actor.name);
    }
  }
  return { ...ctx, invitationAcceptedBy: acceptedBy };
}

function roleLabel(value: unknown): string | null {
  return isOrgRole(value) ? ROLE_LABELS[value] : null;
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

const FIELD_LABELS: Record<string, string> = { name: 'name', timezone: 'time zone', slug: 'address' };

export function describeAuditEntry(entry: AuditLogDto, ctx: AuditContext): SentencePart[] {
  const isMe = (id: string | null | undefined) => id != null && id === ctx.currentUserId;
  const actorIsMe = isMe(entry.actor.id);
  const actor: SentencePart =
    entry.actor.type === 'system' ? { strong: 'Ledora' } : actorIsMe ? { strong: 'You' } : { strong: entry.actor.name ?? 'Someone' };

  const targetId = entry.target?.id ?? null;
  const targetUserName = (() => {
    if (entry.target?.type !== 'user' || !targetId) return null;
    if (isMe(targetId)) return 'you';
    // Current name from the members list; else the snapshot recorded with the event.
    return ctx.memberNames.get(targetId) ?? (typeof entry.metadata.name === 'string' ? entry.metadata.name : null);
  })();
  const m = entry.metadata;
  const metaEmail = typeof m.email === 'string' ? m.email : undefined;

  switch (entry.action) {
    case 'org.created': {
      const slug = typeof m.slug === 'string' ? m.slug : null;
      return slug ? [actor, ' created the organization at ', { strong: `ledora.com/${slug}` }] : [actor, ' created the organization'];
    }
    case 'org.updated': {
      const fields = Array.isArray(m.fields) ? m.fields.filter((f): f is string => typeof f === 'string') : [];
      const from = typeof m.fromSlug === 'string' ? m.fromSlug : null;
      const to = typeof m.toSlug === 'string' ? m.toSlug : null;
      const others = fields.filter((f) => f !== 'slug').map((f) => FIELD_LABELS[f] ?? f);
      if (from && to) {
        const parts: SentencePart[] = [
          actor,
          ' changed the organization address from ',
          { strong: `ledora.com/${from}` },
          ' to ',
          { strong: `ledora.com/${to}` },
        ];
        if (others.length > 0) parts.push(` and updated its ${joinList(others)}`);
        return parts;
      }
      if (others.length === 0) return [actor, ' updated the organization settings'];
      return [actor, ` updated the organization ${joinList(others)}`];
    }
    case 'org.deleted':
      return [actor, ' deleted the organization'];
    case 'member.role_changed': {
      const from = roleLabel(m.from);
      const to = roleLabel(m.to);
      const change: SentencePart[] = from && to ? [' from ', { strong: from }, ' to ', { strong: to }] : [];
      if (targetId && targetId === entry.actor.id) {
        return [actor, actorIsMe ? ' changed your own role' : ' changed their own role', ...change];
      }
      const who: SentencePart = targetUserName === 'you' ? 'your' : targetUserName ? { strong: possessive(targetUserName) } : 'a member’s';
      return [actor, ' changed ', who, ' role', ...change];
    }
    case 'member.removed': {
      const role = roleLabel(m.role);
      if (targetUserName === 'you') return [actor, ' removed ', { strong: 'you' }, ' from the organization'];
      if (targetUserName) return [actor, ' removed ', { strong: targetUserName }, ' from the organization'];
      return role
        ? [actor, ' removed a member with the ', { strong: role }, ' role']
        : [actor, ' removed a member from the organization'];
    }
    case 'member.left':
      return [actor, ' left the organization'];
    case 'invitation.created': {
      const role = roleLabel(m.role);
      const email = (targetId ? (ctx.invitationEmails?.get(targetId) ?? ctx.invitationAcceptedBy?.get(targetId)) : undefined) ?? metaEmail;
      const who: SentencePart = email ? { strong: email } : 'someone';
      return role ? [actor, ' invited ', who, ' as ', { strong: role }] : [actor, ' invited ', who];
    }
    case 'invitation.revoked': {
      const email = (targetId ? ctx.invitationEmails?.get(targetId) : undefined) ?? metaEmail;
      return email ? [actor, ' revoked the invitation for ', { strong: email }] : [actor, ' revoked an invitation'];
    }
    case 'invitation.accepted': {
      const role = roleLabel(m.role);
      return role ? [actor, ' joined the organization as ', { strong: role }] : [actor, ' joined the organization'];
    }
    default:
      return [actor, ` performed “${entry.action.replace(/[._]/g, ' ')}”`];
  }
}

export function sentenceToText(parts: SentencePart[]): string {
  return parts.map((p) => (typeof p === 'string' ? p : p.strong)).join('');
}
