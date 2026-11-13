import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditLogModel } from '../src/modules/audit/auditLog.model.js';
import { MembershipModel } from '../src/modules/memberships/membership.model.js';
import { Client, addMember, createOrg, lastToken, setupTestEnv, signUp, uniqueEmail, type TestEnv } from './helpers.js';

let env: TestEnv;
beforeAll(async () => {
  env = await setupTestEnv();
});
afterAll(async () => env.teardown());

describe('organizations', () => {
  it('requires a verified email to create one', async () => {
    const { client } = await signUp(env, { verify: false });
    const res = await client.post('/orgs', { name: 'Unverified Co' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('makes the creator the owner and derives a unique slug', async () => {
    const a = await signUp(env);
    const b = await signUp(env);
    const first = await createOrg(a.client, 'Northwind Traders');
    const second = await createOrg(b.client, 'Northwind Traders');
    expect(first.slug).toBe('northwind-traders');
    expect(second.slug).not.toBe(first.slug);
    expect(second.slug).toMatch(/^northwind-traders-[a-f0-9]{6}$/);
    const members = await a.client.get(`/orgs/${first.id}/members`);
    expect(members.body.items).toEqual([expect.objectContaining({ userId: a.userId, role: 'owner' })]);
  });

  it('never assigns a reserved route as a slug', async () => {
    const { client } = await signUp(env);
    const explicit = await client.post('/orgs', { name: 'Login', slug: 'login' });
    expect(explicit.status).toBe(400);
    expect(explicit.body.error.fields.slug).toBe('This address is reserved');
    const derived = await createOrg(client, 'Pricing');
    expect(derived.slug).not.toBe('pricing');
  });

  it('keeps old slugs reserved for the organization after a rename', async () => {
    const a = await signUp(env);
    const b = await signUp(env);
    const org = await createOrg(a.client, 'Old Name');
    const renamed = await a.client.patch(`/orgs/${org.id}`, { slug: 'new-name-co' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.slug).toBe('new-name-co');
    const steal = await b.client.post('/orgs', { name: 'Thief', slug: org.slug });
    expect(steal.status).toBe(409);
    // The original organization may take its old slug back.
    expect((await a.client.patch(`/orgs/${org.id}`, { slug: org.slug })).status).toBe(200);
  });

  it('soft-deletes only after typing the exact name', async () => {
    const { client } = await signUp(env);
    const org = await createOrg(client, 'Temp Org');
    expect((await client.delete(`/orgs/${org.id}`, { confirmName: 'temp org' })).status).toBe(400);
    expect((await client.delete(`/orgs/${org.id}`, { confirmName: 'Temp Org' })).status).toBe(204);
    expect((await client.get(`/orgs/${org.id}`)).status).toBe(404);
    expect(await AuditLogModel.exists({ action: 'org.deleted' })).toBeTruthy();
  });
});

describe('organization limit', () => {
  let limited: TestEnv;
  beforeAll(async () => {
    await env.teardown();
    limited = await setupTestEnv({ MAX_ORGS_PER_USER: '2' });
    env = limited;
  });

  it('caps owned organizations but does not count deleted ones', async () => {
    const { client } = await signUp(limited);
    const first = await createOrg(client, 'One Co');
    await createOrg(client, 'Two Co');
    expect((await client.post('/orgs', { name: 'Three Co' })).status).toBe(403);
    expect((await client.delete(`/orgs/${first.id}`, { confirmName: 'One Co' })).status).toBe(204);
    expect((await client.post('/orgs', { name: 'Three Co' })).status).toBe(201);
  });
});

describe('invitations', () => {
  it('runs the full invite → preview → accept flow', async () => {
    const owner = await signUp(env);
    const org = await createOrg(owner.client, 'Invite Co');
    const inviteeEmail = uniqueEmail('invitee');
    const inv = await owner.client.post(`/orgs/${org.id}/invitations`, { email: inviteeEmail, role: 'manager' });
    expect(inv.status).toBe(201);
    const token = lastToken(env, inviteeEmail);

    const preview = await new Client(env.app).post('/invitations/preview', { token });
    expect(preview.body).toMatchObject({ organizationName: 'Invite Co', email: inviteeEmail, role: 'manager' });

    // A different signed-in account cannot use the link.
    const stranger = await signUp(env);
    const wrong = await stranger.client.post('/invitations/accept', { token });
    expect(wrong.status).toBe(403);

    const invitee = await signUp(env, { email: inviteeEmail });
    const ok = await invitee.client.post('/invitations/accept', { token });
    expect(ok.status).toBe(200);
    const mine = await invitee.client.get('/me/organizations');
    expect(mine.body).toEqual([expect.objectContaining({ id: org.id, role: 'manager' })]);
    expect((await invitee.client.post('/invitations/accept', { token })).status).toBe(400);
  });

  it('a revoked invitation cannot be accepted', async () => {
    const owner = await signUp(env);
    const org = await createOrg(owner.client, 'Revoke Co');
    const email = uniqueEmail();
    const inv = await owner.client.post(`/orgs/${org.id}/invitations`, { email, role: 'viewer' });
    const token = lastToken(env, email);
    expect((await owner.client.delete(`/orgs/${org.id}/invitations/${inv.body.id}`)).status).toBe(204);
    const revoked = await AuditLogModel.findOne({ action: 'invitation.revoked', targetId: inv.body.id }).lean();
    expect(revoked?.metadata).toMatchObject({ email, role: 'viewer' });
    const invitee = await signUp(env, { email });
    expect((await invitee.client.post('/invitations/accept', { token })).status).toBe(400);
  });

  it('does not invite existing members', async () => {
    const owner = await signUp(env);
    const org = await createOrg(owner.client, 'Dup Co');
    const res = await owner.client.post(`/orgs/${org.id}/invitations`, { email: owner.email, role: 'viewer' });
    expect(res.status).toBe(409);
  });
});

describe('role hierarchy', () => {
  it('stops admins from creating or managing admins and owners', async () => {
    const owner = await signUp(env);
    const org = await createOrg(owner.client, 'Hierarchy Co');
    const admin = await signUp(env);
    await addMember(env, owner.client, org.id, admin, 'admin');
    const otherAdmin = await signUp(env);
    await addMember(env, owner.client, org.id, otherAdmin, 'admin');

    expect((await admin.client.post(`/orgs/${org.id}/invitations`, { email: uniqueEmail(), role: 'owner' })).status).toBe(403);
    expect((await admin.client.post(`/orgs/${org.id}/invitations`, { email: uniqueEmail(), role: 'admin' })).status).toBe(403);
    expect((await admin.client.post(`/orgs/${org.id}/invitations`, { email: uniqueEmail(), role: 'manager' })).status).toBe(201);
    expect((await admin.client.patch(`/orgs/${org.id}/members/${owner.userId}`, { role: 'viewer' })).status).toBe(403);
    expect((await admin.client.delete(`/orgs/${org.id}/members/${otherAdmin.userId}`)).status).toBe(403);
    expect((await admin.client.patch(`/orgs/${org.id}/members/${admin.userId}`, { role: 'owner' })).status).toBe(403);
  });

  it('never leaves an organization without an owner', async () => {
    const owner = await signUp(env);
    const org = await createOrg(owner.client, 'Owner Co');
    const leave = await owner.client.delete(`/orgs/${org.id}/members/${owner.userId}`);
    expect(leave.status).toBe(409);
    expect(leave.body.error.code).toBe('LAST_OWNER');
    const demote = await owner.client.patch(`/orgs/${org.id}/members/${owner.userId}`, { role: 'admin' });
    expect(demote.status).toBe(409);
  });

  it('stays consistent when two owners demote each other at the same time', async () => {
    const a = await signUp(env);
    const org = await createOrg(a.client, 'Race Co');
    const b = await signUp(env);
    await addMember(env, a.client, org.id, b, 'owner');

    const [r1, r2] = await Promise.all([
      a.client.patch(`/orgs/${org.id}/members/${b.userId}`, { role: 'viewer' }),
      b.client.patch(`/orgs/${org.id}/members/${a.userId}`, { role: 'viewer' }),
    ]);
    const statuses = [r1.status, r2.status].sort();
    // Exactly one wins; the other is refused (403 because it was demoted first, or 409 last-owner).
    expect(statuses[0]).toBe(200);
    expect([403, 409]).toContain(statuses[1]);
    const owners = await MembershipModel.countDocuments({ role: 'owner', orgId: org.id });
    expect(owners).toBe(1);
  });

  it('lets an owner hand over ownership and step down', async () => {
    const a = await signUp(env);
    const org = await createOrg(a.client, 'Handover Co');
    const b = await signUp(env);
    await addMember(env, a.client, org.id, b, 'admin');
    expect((await a.client.patch(`/orgs/${org.id}/members/${b.userId}`, { role: 'owner' })).status).toBe(200);
    expect((await a.client.patch(`/orgs/${org.id}/members/${a.userId}`, { role: 'admin' })).status).toBe(200);
    const log = await AuditLogModel.find({ action: 'member.role_changed' }).lean();
    expect(log.length).toBeGreaterThanOrEqual(2);
  });
});
