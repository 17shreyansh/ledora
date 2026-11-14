import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditLogModel } from '../src/modules/audit/auditLog.model.js';
import { addMember, createOrg, setPlan, setupTestEnv, signUp, type TestEnv } from './helpers.js';

let env: TestEnv;
beforeAll(async () => {
  env = await setupTestEnv();
});
afterAll(async () => env.teardown());

describe('websites', () => {
  it('creates a website with a public site key and sensible allowed domains', async () => {
    const { client } = await signUp(env);
    const org = await createOrg(client, 'Shop Co');
    const res = await client.post(`/orgs/${org.id}/websites`, { name: 'Shop', domain: 'https://www.Shop.example.com/pricing' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'Shop',
      domain: 'www.shop.example.com',
      allowedDomains: ['www.shop.example.com', 'shop.example.com'],
      installation: { status: 'not_installed', firstSeenAt: null },
      tracking: { consentRequired: false, respectDoNotTrack: true },
    });
    expect(res.body.siteKey).toMatch(/^ldr_[A-Za-z0-9_-]{20}$/);
    expect(await AuditLogModel.exists({ action: 'website.created' })).toBeTruthy();
  });

  it('enforces the plan website limit on the server', async () => {
    const { client } = await signUp(env);
    const org = await createOrg(client, 'Limit Co'); // Free: 1 website
    expect((await client.post(`/orgs/${org.id}/websites`, { name: 'One', domain: 'one.example.com' })).status).toBe(201);
    const second = await client.post(`/orgs/${org.id}/websites`, { name: 'Two', domain: 'two.example.com' });
    expect(second.status).toBe(403);
    expect(second.body.error.code).toBe('PLAN_LIMIT');
    const usage = await client.get(`/orgs/${org.id}/usage`);
    expect(usage.body).toMatchObject({ plan: { key: 'free' }, limits: { websites: 1 }, usage: { websites: 1, teamMembers: 1, monthlyEvents: 0 } });
  });

  it('cannot exceed the limit with concurrent creates', async () => {
    const { client } = await signUp(env);
    const org = await createOrg(client, 'Race Sites');
    await setPlan(org.id, 'free', { websites: 2 });
    const results = await Promise.all(
      [1, 2, 3, 4].map((i) => client.post(`/orgs/${org.id}/websites`, { name: `S${i}`, domain: `s${i}.example.com` })),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(2);
    expect((await client.get(`/orgs/${org.id}/websites`)).body).toHaveLength(2);
  });

  it('updates allowed domains and tracking, validates input, rotates keys and deletes', async () => {
    const { client } = await signUp(env);
    const org = await createOrg(client, 'Edit Co');
    const site = (await client.post(`/orgs/${org.id}/websites`, { name: 'Blog', domain: 'blog.example.com' })).body;

    const bad = await client.patch(`/orgs/${org.id}/websites/${site.id}`, { allowedDomains: ['10.0.0.1'] });
    expect(bad.status).toBe(400);
    const tooMany = await client.patch(`/orgs/${org.id}/websites/${site.id}`, { allowedDomains: Array.from({ length: 21 }, (_, i) => `d${i}.example.com`) });
    expect(tooMany.status).toBe(400);

    const ok = await client.patch(`/orgs/${org.id}/websites/${site.id}`, {
      allowedDomains: ['*.Example.com', 'blog.example.com'],
      tracking: { consentRequired: true },
    });
    expect(ok.status).toBe(200);
    expect(ok.body.allowedDomains).toEqual(['*.example.com', 'blog.example.com']);
    expect(ok.body.tracking).toEqual({ consentRequired: true, respectDoNotTrack: true });

    const rotated = await client.post(`/orgs/${org.id}/websites/${site.id}/rotate-key`);
    expect(rotated.body.siteKey).not.toBe(site.siteKey);

    expect((await client.delete(`/orgs/${org.id}/websites/${site.id}`, { confirmName: 'blog' })).status).toBe(400);
    expect((await client.delete(`/orgs/${org.id}/websites/${site.id}`, { confirmName: 'Blog' })).status).toBe(204);
    expect((await client.get(`/orgs/${org.id}/websites/${site.id}`)).status).toBe(404);
  });

  it('lets analysts read but not manage websites', async () => {
    const owner = await signUp(env);
    const org = await createOrg(owner.client, 'Roles Co');
    const site = (await owner.client.post(`/orgs/${org.id}/websites`, { name: 'Main', domain: 'main.example.com' })).body;
    const analyst = await signUp(env);
    await addMember(env, owner.client, org.id, analyst, 'analyst');
    expect((await analyst.client.get(`/orgs/${org.id}/websites`)).status).toBe(200);
    expect((await analyst.client.get(`/orgs/${org.id}/websites/${site.id}/stats`)).status).toBe(200);
    expect((await analyst.client.post(`/orgs/${org.id}/websites`, { name: 'X', domain: 'x.example.com' })).status).toBe(403);
    expect((await analyst.client.patch(`/orgs/${org.id}/websites/${site.id}`, { name: 'Y' })).status).toBe(403);
    expect((await analyst.client.post(`/orgs/${org.id}/websites/${site.id}/rotate-key`)).status).toBe(403);
    expect((await analyst.client.delete(`/orgs/${org.id}/websites/${site.id}`, { confirmName: 'Main' })).status).toBe(403);
  });

  it("never exposes another organization's website, even through the attacker's own org", async () => {
    const alice = await signUp(env);
    const orgA = await createOrg(alice.client, 'Alice Sites');
    const site = (await alice.client.post(`/orgs/${orgA.id}/websites`, { name: 'Secret', domain: 'secret.example.com' })).body;
    const bob = await signUp(env);
    const orgB = await createOrg(bob.client, 'Bob Sites');
    for (const res of await Promise.all([
      bob.client.get(`/orgs/${orgA.id}/websites`),
      bob.client.get(`/orgs/${orgB.id}/websites/${site.id}`),
      bob.client.get(`/orgs/${orgB.id}/websites/${site.id}/stats`),
      bob.client.patch(`/orgs/${orgB.id}/websites/${site.id}`, { name: 'Pwned' }),
      bob.client.post(`/orgs/${orgB.id}/websites/${site.id}/rotate-key`),
      bob.client.delete(`/orgs/${orgB.id}/websites/${site.id}`, { confirmName: 'Secret' }),
    ])) {
      expect(res.status).toBe(404);
    }
    expect((await alice.client.get(`/orgs/${orgA.id}/websites/${site.id}`)).body.name).toBe('Secret');
  });
});
