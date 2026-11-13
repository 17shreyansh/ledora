import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupTestEnv, type TestEnv } from './helpers.js';

let env: TestEnv;
beforeAll(async () => {
  env = await setupTestEnv();
});
afterAll(async () => env.teardown());

describe('platform', () => {
  it('reports liveness and readiness', async () => {
    expect((await request(env.app).get('/healthz')).status).toBe(200);
    const ready = await request(env.app).get('/readyz');
    expect(ready.status).toBe(200);
    expect(ready.body.checks).toEqual({ mongo: 'up', redis: 'up' });
  });

  it('echoes a well-formed request id and generates one otherwise', async () => {
    const echoed = await request(env.app).get('/healthz').set('X-Request-Id', 'edge-abc12345');
    expect(echoed.headers['x-request-id']).toBe('edge-abc12345');
    const generated = await request(env.app).get('/healthz').set('X-Request-Id', 'bad id with spaces');
    expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('returns structured JSON errors for unknown routes', async () => {
    const res = await request(env.app).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.requestId).toBeTruthy();
  });

  it('rejects oversized and malformed bodies', async () => {
    const big = await request(env.app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'a@b.co', password: 'x'.repeat(200_000) }));
    expect(big.status).toBe(413);
    const bad = await request(env.app).post('/api/v1/auth/login').set('Content-Type', 'application/json').send('{not json');
    expect(bad.status).toBe(400);
  });

  it('rejects NoSQL operator injection in credentials', async () => {
    const res = await request(env.app).post('/api/v1/auth/login').send({ email: { $ne: null }, password: { $ne: null } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('sets security headers and no-store on API responses', async () => {
    const res = await request(env.app).get('/api/v1/auth/session');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
