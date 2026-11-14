import type { AnyBulkWriteOperation } from 'mongoose';
import type { AnalyticsEvent } from './analyticsEvent.model.js';
import { AnalyticsSessionModel, AnalyticsVisitorModel, type AnalyticsSession, type AnalyticsVisitor } from './sessionVisitor.models.js';

type StoredEvent = Omit<AnalyticsEvent, '_id'>;

/** Wraps a user-supplied value so an aggregation pipeline never interprets it ("$..." strings). */
const lit = (v: unknown) => ({ $literal: v });

/**
 * Folds newly stored events (never duplicates) into per-session and per-visitor
 * documents with idempotent-per-batch pipeline upserts. Out-of-order batches are
 * handled: start/end use min/max and entry/exit paths follow the earliest/latest event.
 */
export async function foldIntoSessions(events: readonly StoredEvent[]): Promise<void> {
  if (events.length === 0) return;
  const bySession = new Map<string, StoredEvent[]>();
  const byVisitor = new Map<string, StoredEvent[]>();
  for (const e of events) {
    const sk = `${e.websiteId.toHexString()}|${e.sessionId}`;
    const vk = `${e.websiteId.toHexString()}|${e.visitorId}`;
    bySession.set(sk, [...(bySession.get(sk) ?? []), e]);
    byVisitor.set(vk, [...(byVisitor.get(vk) ?? []), e]);
  }

  const sessionOps: AnyBulkWriteOperation<AnalyticsSession>[] = [];
  for (const list of bySession.values()) {
    const sorted = [...list].sort((a, b) => a.ts.getTime() - b.ts.getTime());
    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;
    const pvs = sorted.filter((e) => e.type === 'pageview');
    const entry = (pvs[0] ?? first).path;
    const exit = (pvs[pvs.length - 1] ?? last).path;
    const pageviews = pvs.length;
    const custom = sorted.length - pageviews;
    const firstTs = first.ts;
    const lastTs = last.ts;
    const expiresAt = sorted.reduce((m, e) => (e.expiresAt > m ? e.expiresAt : m), first.expiresAt);
    const isNew = { $eq: [{ $type: '$startedAt' }, 'missing'] };
    sessionOps.push({
      updateOne: {
        filter: { websiteId: first.websiteId, sessionId: first.sessionId },
        upsert: true,
        update: [
          {
            $set: {
              orgId: first.orgId,
              visitorId: { $ifNull: ['$visitorId', lit(first.visitorId)] },
              entryPath: { $cond: [{ $or: [isNew, { $lt: [lit(firstTs), '$startedAt'] }] }, lit(entry), '$entryPath'] },
              exitPath: { $cond: [{ $or: [isNew, { $gte: [lit(lastTs), '$endedAt'] }] }, lit(exit), '$exitPath'] },
              startedAt: { $min: [{ $ifNull: ['$startedAt', lit(firstTs)] }, lit(firstTs)] },
              endedAt: { $max: [{ $ifNull: ['$endedAt', lit(lastTs)] }, lit(lastTs)] },
              pageviews: { $add: [{ $ifNull: ['$pageviews', 0] }, pageviews] },
              events: { $add: [{ $ifNull: ['$events', 0] }, custom] },
              referrerHost: { $ifNull: ['$referrerHost', lit(first.referrerHost)] },
              utm: { $ifNull: ['$utm', lit(first.utm)] },
              device: { $ifNull: ['$device', lit(first.device)] },
              expiresAt: { $max: [{ $ifNull: ['$expiresAt', lit(expiresAt)] }, lit(expiresAt)] },
            },
          },
        ],
      },
    });
  }

  const visitorOps: AnyBulkWriteOperation<AnalyticsVisitor>[] = [];
  for (const list of byVisitor.values()) {
    const first = list.reduce((a, b) => (b.ts < a.ts ? b : a));
    const last = list.reduce((a, b) => (b.ts > a.ts ? b : a));
    visitorOps.push({
      updateOne: {
        filter: { websiteId: first.websiteId, visitorId: first.visitorId },
        upsert: true,
        update: {
          $setOnInsert: { orgId: first.orgId },
          $min: { firstSeenAt: first.ts },
          $max: { lastSeenAt: last.ts, expiresAt: last.expiresAt },
        },
      },
    });
  }

  await Promise.all([
    AnalyticsSessionModel.bulkWrite(sessionOps, { ordered: false }),
    AnalyticsVisitorModel.bulkWrite(visitorOps, { ordered: false }),
  ]);
}
