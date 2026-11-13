import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditLogModel } from '../src/modules/audit/auditLog.model.js';
import { SessionModel } from '../src/modules/auth/session.model.js';
import { Client, PASSWORD, lastToken, setupTestEnv, signUp, uniqueEmail, type TestEnv } from './helpers.js';

let env: TestEnv;
beforeAll(async () => {
  env = await setupTestEnv();
});
afterAll(async () => env.teardown());

describe('registration', () => {
  it('creates an account, signs in with an HttpOnly cookie and sends a verification email', async () => {
    const client = new Client(env.app);
    const email = uniqueEmail();
    const res = await client.post('/auth/register', { name: 'Ada', email: email.toUpperCase(), password: PASSWORD });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email, name: 'Ada', emailVerified: false });
    expect(res.body.user.passwordHash).toBeUndefined();
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/ledora_sid=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(env.mail.last(email)?.template).toBe('verify_email');

    const session = await client.get('/auth/session');
    expect(session.status).toBe(200);
    expect(session.body.csrfToken).toBe(res.body.csrfToken);
  });

  it('stores only hashed session tokens', async () => {
    const client = new Client(env.app);
    const res = await client.post('/auth/register', { name: 'Hash', email: uniqueEmail(), password: PASSWORD });
    const raw = /ledora_sid=([^;]+)/.exec(String(res.headers['set-cookie']))![1]!;
    expect(await SessionModel.exists({ tokenHash: raw })).toBeNull();
  });

  it('rejects duplicate emails and weak passwords with field errors', async () => {
    const { email } = await signUp(env);
    const dup = await new Client(env.app).post('/auth/register', { name: 'X', email, password: PASSWORD });
    expect(dup.status).toBe(409);
    expect(dup.body.error.fields.email).toBeTruthy();

    const weak = await new Client(env.app).post('/auth/register', { name: 'X', email: uniqueEmail(), password: 'short' });
    expect(weak.status).toBe(400);
    expect(weak.body.error.fields.password).toBeTruthy();
  });
});

describe('email verification', () => {
  it('verifies once; the link cannot be reused', async () => {
    const { client, email } = await signUp(env, { verify: false });
    const token = lastToken(env, email);
    expect((await client.post('/auth/verify-email', { token })).status).toBe(204);
    expect((await client.get('/me')).body.emailVerified).toBe(true);
    const again = await client.post('/auth/verify-email', { token });
    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe('TOKEN_INVALID');
  });

  it('invalidates older verification links when a new one is requested', async () => {
    const { client, email } = await signUp(env, { verify: false });
    const first = lastToken(env, email);
    expect((await client.post('/auth/resend-verification')).status).toBe(202);
    const second = lastToken(env, email);
    expect((await client.post('/auth/verify-email', { token: first })).status).toBe(400);
    expect((await client.post('/auth/verify-email', { token: second })).status).toBe(204);
  });
});

describe('login', () => {
  it('gives the same answer for a wrong password and an unknown email', async () => {
    const { email } = await signUp(env);
    const wrong = await new Client(env.app).post('/auth/login', { email, password: 'not-the-password' });
    const unknown = await new Client(env.app).post('/auth/login', { email: uniqueEmail(), password: 'not-the-password' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
    expect(await AuditLogModel.exists({ action: 'auth.login_failed' })).toBeTruthy();
  });

  it('logs out by destroying the server-side session', async () => {
    const { email } = await signUp(env);
    const c = new Client(env.app);
    const login = await c.post('/auth/login', { email, password: PASSWORD });
    expect(login.status).toBe(200);
    c.csrf = login.body.csrfToken;
    const raw = /ledora_sid=([^;]+)/.exec(String(login.headers['set-cookie']))![1]!;
    expect((await c.post('/auth/logout')).status).toBe(204);
    // Replaying the old cookie must not work.
    const replay = await request(env.app).get('/api/v1/me').set('Cookie', `ledora_sid=${raw}`);
    expect(replay.status).toBe(401);
  });
});

describe('CSRF and origin protection', () => {
  it('rejects authenticated state changes without the CSRF token', async () => {
    const { client } = await signUp(env);
    const res = await client.agent.patch('/api/v1/me').send({ name: 'Mallory' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_FAILED');
    const wrong = await client.agent.patch('/api/v1/me').set('X-CSRF-Token', 'x'.repeat(64)).send({ name: 'Mallory' });
    expect(wrong.status).toBe(403);
    expect((await client.patch('/me', { name: 'Grace' })).status).toBe(200);
  });

  it('rejects state changes from foreign origins, including login', async () => {
    const res = await request(env.app)
      .post('/api/v1/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ email: 'a@example.com', password: 'whatever' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_FAILED');
  });

  it('allows the configured app origin with credentials (CORS)', async () => {
    const res = await request(env.app).options('/api/v1/auth/login').set('Origin', 'http://app.test').set('Access-Control-Request-Method', 'POST');
    expect(res.headers['access-control-allow-origin']).toBe('http://app.test');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    const foreign = await request(env.app).options('/api/v1/auth/login').set('Origin', 'https://evil.example').set('Access-Control-Request-Method', 'POST');
    expect(foreign.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('password reset and change', () => {
  it('does not reveal whether an account exists', async () => {
    env.mail.clear();
    const res = await new Client(env.app).post('/auth/forgot-password', { email: uniqueEmail() });
    expect(res.status).toBe(202);
    expect(env.mail.sent).toHaveLength(0);
  });

  it('resets the password, revokes every session and burns the token', async () => {
    const { client, email } = await signUp(env);
    expect((await new Client(env.app).post('/auth/forgot-password', { email })).status).toBe(202);
    const token = lastToken(env, email);
    const reset = await new Client(env.app).post('/auth/reset-password', { token, password: 'a brand new passphrase' });
    expect(reset.status).toBe(204);
    expect((await client.get('/me')).status).toBe(401);
    expect((await new Client(env.app).post('/auth/reset-password', { token, password: 'another passphrase!' })).status).toBe(400);
    expect((await new Client(env.app).post('/auth/login', { email, password: PASSWORD })).status).toBe(401);
    expect((await new Client(env.app).post('/auth/login', { email, password: 'a brand new passphrase' })).status).toBe(200);
    expect(env.mail.last(email)?.template).toBe('password_changed');
  });

  it('changing the password keeps the current session and ends the others', async () => {
    const { client, email } = await signUp(env);
    const other = new Client(env.app);
    expect((await other.post('/auth/login', { email, password: PASSWORD })).status).toBe(200);

    const wrong = await client.post('/me/password', { currentPassword: 'nope', newPassword: 'another long passphrase' });
    expect(wrong.status).toBe(400);
    const res = await client.post('/me/password', { currentPassword: PASSWORD, newPassword: 'another long passphrase' });
    expect(res.status).toBe(200);
    client.csrf = res.body.csrfToken;
    expect((await client.get('/me')).status).toBe(200);
    expect((await other.get('/me')).status).toBe(401);
  });
});

describe('rate limiting (enabled)', () => {
  let limited: TestEnv;
  beforeAll(async () => {
    await env.teardown();
    limited = await setupTestEnv({ RATE_LIMIT_ENABLED: 'true' });
    env = limited; // afterAll tears down whichever env is current
  });

  it('locks an email after repeated failed sign-ins, even for the correct password', async () => {
    const { email } = await signUp(limited);
    for (let i = 0; i < 10; i++) {
      const r = await new Client(limited.app).post('/auth/login', { email, password: `wrong-${i}` });
      expect(r.status).toBe(401);
    }
    const locked = await new Client(limited.app).post('/auth/login', { email, password: PASSWORD });
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe('RATE_LIMITED');
  });

  it('throttles verification email resends', async () => {
    const { client } = await signUp(limited, { verify: false });
    expect((await client.post('/auth/resend-verification')).status).toBe(202);
    expect((await client.post('/auth/resend-verification')).status).toBe(429);
  });
});
