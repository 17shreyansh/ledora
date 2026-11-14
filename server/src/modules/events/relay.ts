import type { Queue } from 'bullmq';
import { logger } from '../../common/logger.js';
import type { EventEnvelope, EventType } from './events.js';
import { OutboxModel, type OutboxEvent } from './outbox.model.js';

const LOCK_MS = 30_000;
const RETAIN_RELAYED_MS = 7 * 86_400_000;

export function toEnvelope(row: OutboxEvent): EventEnvelope {
  const { correlationId, ...data } = row.data as { correlationId?: string | null } & Record<string, unknown>;
  return {
    id: row.eventId,
    type: row.type as EventType,
    version: row.version,
    occurredAt: row.occurredAt.toISOString(),
    orgId: row.orgId.toHexString(),
    websiteId: row.websiteId?.toHexString() ?? null,
    subject: row.subject,
    correlationId: correlationId ?? null,
    data,
  };
}

/**
 * Moves pending outbox rows to the queues of every consumer subscribed to their type.
 * Safe to run in several worker processes at once: rows are claimed with a short lease,
 * and queue jobs use the event id as job id, so a re-relay after a crash is a no-op.
 * Returns the number of rows relayed.
 */
export async function relayOutboxOnce(
  routes: ReadonlyMap<string, ReadonlyArray<Queue<EventEnvelope>>>,
  maxRows = 100,
): Promise<number> {
  let relayed = 0;
  for (let i = 0; i < maxRows; i++) {
    const now = new Date();
    const row = await OutboxModel.findOneAndUpdate(
      { relayedAt: null, $or: [{ lockedUntil: null }, { lockedUntil: { $lt: now } }] },
      { $set: { lockedUntil: new Date(now.getTime() + LOCK_MS) } },
      { sort: { _id: 1 }, new: true },
    ).lean<OutboxEvent>();
    if (!row) break;
    const envelope = toEnvelope(row);
    const queues = routes.get(row.type) ?? [];
    await Promise.all(queues.map((q) => q.add(row.type, envelope, { jobId: row.eventId })));
    await OutboxModel.updateOne(
      { _id: row._id },
      { $set: { relayedAt: new Date(), expiresAt: new Date(Date.now() + RETAIN_RELAYED_MS), lockedUntil: null } },
    );
    relayed++;
    if (queues.length === 0) logger.debug({ type: row.type }, 'Outbox event has no consumers');
  }
  return relayed;
}
