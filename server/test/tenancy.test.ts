import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addMember, createOrg, setPlan, setupTestEnv, signUp, type TestEnv } from './helpers.js';

let env: TestEnv;
let alice: Awaited<ReturnType<typeof signUp>>; // owner of A
let bob: Awaited<ReturnType<typeof signUp>>; // owner of B
let orgA: { id: string };
let orgB: { id: string };

beforeAll(async () => {
  env = await setupTestEnv();
  alice = await signUp(env, { name: 'Alice' });
  bob = await signUp(env, { name: 'Bob' });
  orgA = await createOrg(alice.client, 'Alpha Agency');
  orgB = await createOrg(bob.client, 'Beta Bakery');
  await setPlan(orgA.id, 'business');
});
afterAll(async () => env.teardown());

describe('tenant isolation', () => {
  it('lists only the organizations a user belongs to', async () => {
    const res = await bob.client.get('/me/organizations');
    expect(res.body.map((o: { id: string }) => o.id)).toEqual([orgB.id]);
  });

  it("returns 404 (not 403) for every route of another organization", async () => {
    const attempts = [
      bob.client.get(`/orgs/${orgA.id}`),
      bob.client.get(`/orgs/${orgA.id}/members`),
      bob.client.get(`/orgs/${orgA.id}/invitations`),
      bob.client.get(`/orgs/${orgA.id}/audit-logs`),
      bob.client.patch(`/orgs/${orgA.id}`, { name: 'Pwned' }),
      bob.client.post(`/orgs/${orgA.id}/invitations`, { email: 'x@example.com', role: 'owner' }),
      bob.client.patch(`/orgs/${orgA.id}/members/${alice.userId}`, { role: 'viewer' }),
      bob.client.delete(`/orgs/${orgA.id}/members/${alice.userId}`),
      bob.client.delete(`/orgs/${orgA.id}`, { confirmName: 'Alpha Agency' }),
    ];
    for (const res of await Promise.all(attempts)) {
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    }
    expect((await alice.client.get(`/orgs/${orgA.id}`)).body.name).toBe('Alpha Agency');
  });

  it("cannot reach another organization's member through its own organization", async () => {
    const res = await bob.client.patch(`/orgs/${orgB.id}/members/${alice.userId}`, { role: 'viewer' });
    expect(res.status).toBe(404);
    const del = await bob.client.delete(`/orgs/${orgB.id}/members/${alice.userId}`);
    expect(del.status).toBe(404);
  });

  it("cannot revoke another organization's invitation", async () => {
    const inv = await alice.client.post(`/orgs/${orgA.id}/invitations`, { email: 'carol@example.com', role: 'viewer' });
    expect(inv.status).toBe(201);
    expect((await bob.client.delete(`/orgs/${orgB.id}/invitations/${inv.body.id}`)).status).toBe(404);
    expect((await alice.client.get(`/orgs/${orgA.id}/invitations`)).body).toHaveLength(1);
  });

  it('treats malformed and non-existent ids as not found', async () => {
    expect((await alice.client.get('/orgs/not-an-id')).status).toBe(404);
    expect((await alice.client.get('/orgs/0123456789abcdef01234567')).status).toBe(404);
  });

  it('requires authentication', async () => {
    const { Client } = await import('./helpers.js');
    const anon = new Client(env.app);
    expect((await anon.get(`/orgs/${orgA.id}`)).status).toBe(401);
    expect((await anon.get('/me/organizations')).status).toBe(401);
  });
});

describe('role-based access inside an organization', () => {
  let viewer: Awaited<ReturnType<typeof signUp>>;
  beforeAll(async () => {
    viewer = await signUp(env, { name: 'Vera' });
    await addMember(env, alice.client, orgA.id, viewer, 'viewer');
  });

  it('lets a viewer read but not change anything', async () => {
    expect((await viewer.client.get(`/orgs/${orgA.id}`)).status).toBe(200);
    expect((await viewer.client.get(`/orgs/${orgA.id}/members`)).status).toBe(200);
    expect((await viewer.client.patch(`/orgs/${orgA.id}`, { name: 'Nope' })).status).toBe(403);
    expect((await viewer.client.post(`/orgs/${orgA.id}/invitations`, { email: 'z@example.com', role: 'viewer' })).status).toBe(403);
    expect((await viewer.client.get(`/orgs/${orgA.id}/audit-logs`)).status).toBe(403);
    expect((await viewer.client.patch(`/orgs/${orgA.id}/members/${alice.userId}`, { role: 'viewer' })).status).toBe(403);
    expect((await viewer.client.delete(`/orgs/${orgA.id}`, { confirmName: 'Alpha Agency' })).status).toBe(403);
  });

  it('cuts off access immediately when a member is removed', async () => {
    expect((await alice.client.delete(`/orgs/${orgA.id}/members/${viewer.userId}`)).status).toBe(204);
    expect((await viewer.client.get(`/orgs/${orgA.id}`)).status).toBe(404);
    const log = await alice.client.get(`/orgs/${orgA.id}/audit-logs`);
    const removed = log.body.items.find((i: { action: string }) => i.action === 'member.removed');
    expect(removed.metadata).toMatchObject({ role: 'viewer', name: 'Vera' });
  });
});
