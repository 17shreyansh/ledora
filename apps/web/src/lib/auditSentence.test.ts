import type { AuditLogDto } from '@ledora/shared';
import { describe, expect, it } from 'vitest';
import { describeAuditEntry, sentenceToText, withAcceptedInvitations, type AuditContext } from './auditSentence';

const ctx: AuditContext = {
  currentUserId: 'me',
  memberNames: new Map([
    ['ada', 'Ada'],
    ['ben', 'Ben'],
  ]),
  invitationEmails: new Map([['inv1', 'cy@example.com']]),
};

function entry(partial: Partial<AuditLogDto> & Pick<AuditLogDto, 'action'>): AuditLogDto {
  return {
    id: 'a1',
    actor: { type: 'user', id: 'ada', name: 'Ada' },
    target: null,
    metadata: {},
    createdAt: '2026-11-13T10:00:00.000Z',
    ...partial,
  };
}

const text = (e: AuditLogDto) => sentenceToText(describeAuditEntry(e, ctx));

describe('audit sentences', () => {
  it('falls back to names and emails recorded with the event', () => {
    expect(
      text(entry({ action: 'member.removed', target: { type: 'user', id: 'gone' }, metadata: { role: 'viewer', name: 'Vera' } })),
    ).toBe('Ada removed Vera from the organization');
    expect(
      text(entry({ action: 'invitation.revoked', target: { type: 'invitation', id: 'old' }, metadata: { role: 'viewer', email: 'old@example.com' } })),
    ).toBe('Ada revoked the invitation for old@example.com');
    expect(
      text(entry({ action: 'invitation.created', target: { type: 'invitation', id: 'old' }, metadata: { role: 'analyst', email: 'old@example.com' } })),
    ).toBe('Ada invited old@example.com as Analyst');
  });

  it('describes role changes with names and role labels', () => {
    expect(
      text(entry({ action: 'member.role_changed', target: { type: 'user', id: 'ben' }, metadata: { from: 'viewer', to: 'manager' } })),
    ).toBe('Ada changed Ben’s role from Viewer to Manager');
    expect(
      text(entry({ action: 'member.role_changed', target: { type: 'user', id: 'me' }, metadata: { from: 'admin', to: 'owner' } })),
    ).toBe('Ada changed your role from Admin to Owner');
  });

  it('uses "You" for the current user and known invitation emails', () => {
    expect(
      text(entry({ action: 'invitation.created', actor: { type: 'user', id: 'me', name: 'Me' }, target: { type: 'invitation', id: 'inv1' }, metadata: { role: 'analyst' } })),
    ).toBe('You invited cy@example.com as Analyst');
    expect(text(entry({ action: 'invitation.revoked', target: { type: 'invitation', id: 'unknown' } }))).toBe('Ada revoked an invitation');
  });

  it('names the person who accepted an invitation when the log shows it', () => {
    const created = entry({ action: 'invitation.created', target: { type: 'invitation', id: 'inv9' }, metadata: { role: 'manager' } });
    const accepted = entry({ id: 'a2', action: 'invitation.accepted', actor: { type: 'user', id: 'ben', name: 'Ben' }, target: { type: 'invitation', id: 'inv9' }, metadata: { role: 'manager' } });
    const enriched = withAcceptedInvitations(ctx, [accepted, created]);
    expect(sentenceToText(describeAuditEntry(created, enriched))).toBe('Ada invited Ben as Manager');
    expect(sentenceToText(describeAuditEntry(accepted, enriched))).toBe('Ben joined the organization as Manager');
  });

  it('describes address changes and falls back for unknown actions', () => {
    expect(
      text(entry({ action: 'org.updated', metadata: { fields: ['slug', 'name'], fromSlug: 'acme', toSlug: 'acme-inc' } })),
    ).toBe('Ada changed the organization address from ledora.com/acme to ledora.com/acme-inc and updated its name');
    expect(text(entry({ action: 'member.removed', target: { type: 'user', id: 'gone' }, metadata: { role: 'viewer' } }))).toBe(
      'Ada removed a member with the Viewer role',
    );
    expect(text(entry({ action: 'something.new' }))).toBe('Ada performed “something new”');
  });
});
