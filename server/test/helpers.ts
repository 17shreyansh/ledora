import mongoose from 'mongoose';
import request from 'supertest';
import type { Express } from 'express';
import { Redis } from 'ioredis';
import { randomBytes } from 'node:crypto';
import { createApp } from '../src/app.js';
import { createLogger, setLogger } from '../src/common/logger.js';
import { loadConfig, type Config } from '../src/config/env.js';
import { MemoryMailDispatcher } from '../src/services/mail/dispatcher.js';

const MONGO_BASE = process.env.TEST_MONGODB_URI ?? 'mongodb://127.0.0.1:27017/?replicaSet=rs0';
const REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://127.0.0.1:6379/15';

export interface TestEnv {
  app: Express;
  config: Config;
  mail: MemoryMailDispatcher;
  redis: Redis;
  teardown(): Promise<void>;
}

/** Boots the real app against a throwaway database. */
export async function setupTestEnv(overrides: Record<string, string> = {}): Promise<TestEnv> {
  setLogger(createLogger('silent'));
  const dbName = `ledora_test_${randomBytes(4).toString('hex')}`;
  const uri = MONGO_BASE.replace('/?', `/${dbName}?`);
  const config = loadConfig({
    NODE_ENV: 'test',
    AUTH_SECRET: 'test-secret-test-secret-test-secret-0123456789',
    MONGODB_URI: uri,
    REDIS_URL,
    APP_URL: 'http://app.test',
    CORS_ORIGINS: 'http://app.test',
    TRUST_PROXY: '0',
    RATE_LIMIT_ENABLED: 'false',
    LOG_LEVEL: 'silent',
    ...overrides,
  });
  await mongoose.connect(uri, { autoIndex: true });
  // Create collections and indexes up front (unique indexes are part of what we test).
  for (const model of Object.values(mongoose.models)) {
    await model.createCollection();
    await model.init();
  }
  const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  await redis.flushdb();
  const mail = new MemoryMailDispatcher();
  const { app } = createApp({ config, redis, mail });
  return {
    app,
    config,
    mail,
    redis,
    async teardown() {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
      await redis.flushdb();
      await redis.quit();
    },
  };
}

/** A browser-like client: keeps cookies and sends the CSRF token on unsafe requests. */
export class Client {
  readonly agent: ReturnType<typeof request.agent>;
  csrf = '';
  constructor(app: Express) {
    this.agent = request.agent(app);
  }
  get(path: string) {
    return this.agent.get(`/api/v1${path}`);
  }
  post(path: string, body?: object) {
    return this.agent.post(`/api/v1${path}`).set('X-CSRF-Token', this.csrf).send(body ?? {});
  }
  patch(path: string, body?: object) {
    return this.agent.patch(`/api/v1${path}`).set('X-CSRF-Token', this.csrf).send(body ?? {});
  }
  delete(path: string, body?: object) {
    return this.agent.delete(`/api/v1${path}`).set('X-CSRF-Token', this.csrf).send(body ?? {});
  }
}

export function tokenFromLink(link: string): string {
  const token = new URL(link).searchParams.get('token');
  if (!token) throw new Error(`No token in ${link}`);
  return token;
}

let counter = 0;
export function uniqueEmail(prefix = 'user'): string {
  counter += 1;
  return `${prefix}${counter}-${randomBytes(3).toString('hex')}@example.com`;
}

export const PASSWORD = 'correct horse battery staple';

/** Registers, verifies email and returns a signed-in client. */
export async function signUp(env: TestEnv, opts: { name?: string; email?: string; verify?: boolean } = {}) {
  const client = new Client(env.app);
  const email = opts.email ?? uniqueEmail();
  const res = await client.post('/auth/register', { name: opts.name ?? 'Test User', email, password: PASSWORD });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  client.csrf = res.body.csrfToken;
  const userId: string = res.body.user.id;
  if (opts.verify !== false) {
    const mail = env.mail.last(email);
    if (mail?.template !== 'verify_email') throw new Error('no verification email');
    const v = await client.post('/auth/verify-email', { token: tokenFromLink(mail.data.link) });
    if (v.status !== 204) throw new Error(`verify failed: ${v.status}`);
  }
  return { client, email, userId };
}

export async function createOrg(client: Client, name = 'Acme Inc') {
  const res = await client.post('/orgs', { name });
  if (res.status !== 201) throw new Error(`create org failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as { id: string; slug: string; name: string };
}

/** Invites `email` into `orgId` with `role` and accepts as `invitee`. */
export async function addMember(env: TestEnv, inviter: Client, orgId: string, invitee: { client: Client; email: string }, role: string) {
  const inv = await inviter.post(`/orgs/${orgId}/invitations`, { email: invitee.email, role });
  if (inv.status !== 201) throw new Error(`invite failed: ${inv.status} ${JSON.stringify(inv.body)}`);
  const mail = env.mail.last(invitee.email);
  if (mail?.template !== 'invitation') throw new Error('no invitation email');
  const acc = await invitee.client.post('/invitations/accept', { token: tokenFromLink(mail.data.link) });
  if (acc.status !== 200) throw new Error(`accept failed: ${acc.status} ${JSON.stringify(acc.body)}`);
}

/** Token from the most recent email (with a link) sent to `email`. */
export function lastToken(env: TestEnv, email: string): string {
  const mail = env.mail.last(email);
  if (!mail || !('link' in mail.data)) throw new Error(`no email with a link for ${email}`);
  return tokenFromLink(mail.data.link);
}
