import { Queue } from 'bullmq';
import { Types } from 'mongoose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTransaction } from '../src/database/transaction.js';
import { emitEvent, type EventEnvelope } from '../src/modules/events/events.js';
import { OutboxModel } from '../src/modules/events/outbox.model.js';
import { relayOutboxOnce } from '../src/modules/events/relay.js';
import { setupTestEnv, type TestEnv } from './helpers.js';

let env: TestEnv;
let queue: Queue<EventEnvelope>;
beforeAll(async () => {
  env = await setupTestEnv();
  queue = new Queue<EventEnvelope>(`test-events-${Date.now()}`, { connection: env.redis.duplicate() });
});
afterAll(async () => {
  await queue.obliterate({ force: true });
  await queue.close();
  await env.teardown();
});

describe('outbox relay', () => {
  it('only publishes events whose transaction committed', async () => {
    const orgId = new Types.ObjectId();
    await expect(
      withTransaction(async (session) => {
        await emitEvent(session, { type: 'website.installation_verified', orgId });
        throw new Error('roll back');
      }),
    ).rejects.toThrow('roll back');
    expect(await OutboxModel.countDocuments({ orgId })).toBe(0);
  });

  it('relays pending events to subscribed queues once, keyed by event id', async () => {
    const orgId = new Types.ObjectId();
    const eventId = await withTransaction((session) =>
      emitEvent(session, { type: 'website.installation_verified', orgId, websiteId: new Types.ObjectId(), data: { sdkVersion: '1.0.0' } }),
    );
    const routes = new Map([['website.installation_verified', [queue]]]);
    expect(await relayOutboxOnce(routes)).toBe(1);
    expect(await relayOutboxOnce(routes)).toBe(0);

    const job = await queue.getJob(eventId);
    expect(job?.data).toMatchObject({ id: eventId, type: 'website.installation_verified', version: 1, orgId: orgId.toHexString(), data: { sdkVersion: '1.0.0' } });
    const row = await OutboxModel.findOne({ eventId }).lean();
    expect(row?.relayedAt).toBeInstanceOf(Date);
    expect(row?.expiresAt).toBeInstanceOf(Date);

    // Simulate a crash after publishing but before marking relayed: re-relay is a no-op.
    await OutboxModel.updateOne({ eventId }, { $set: { relayedAt: null, lockedUntil: null } });
    expect(await relayOutboxOnce(routes)).toBe(1);
    expect(await queue.getJobCounts('waiting', 'delayed', 'active')).toMatchObject({ waiting: 1 });
  });

  it('skips rows leased by another relay', async () => {
    const orgId = new Types.ObjectId();
    const eventId = await withTransaction((session) => emitEvent(session, { type: 'website.installation_verified', orgId }));
    await OutboxModel.updateOne({ eventId }, { $set: { lockedUntil: new Date(Date.now() + 60_000) } });
    expect(await relayOutboxOnce(new Map([['website.installation_verified', [queue]]]))).toBe(0);
  });
});
