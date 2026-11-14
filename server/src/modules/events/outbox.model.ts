import { Schema, model, type Types } from 'mongoose';

/**
 * Transactional outbox (Part 32.1). Business events are written here in the same
 * transaction as the state change that caused them, then relayed to per-consumer
 * queues by the worker. A crash can never produce a change without its event, or an
 * event without its change.
 */
export interface OutboxEvent {
  _id: Types.ObjectId;
  /** Globally unique event id; consumers de-duplicate on it. */
  eventId: string;
  type: string;
  version: number;
  orgId: Types.ObjectId;
  websiteId: Types.ObjectId | null;
  subject: { kind: string; id: string } | null;
  /** IDs and small non-sensitive values only — never emails, names or message text. */
  data: Record<string, unknown>;
  occurredAt: Date;
  lockedUntil: Date | null;
  relayedAt: Date | null;
  /** Set when relayed; a TTL index removes relayed rows a week later. */
  expiresAt: Date | null;
}

const outboxSchema = new Schema<OutboxEvent>(
  {
    eventId: { type: String, required: true },
    type: { type: String, required: true, maxlength: 64 },
    version: { type: Number, required: true, min: 1 },
    orgId: { type: Schema.Types.ObjectId, required: true },
    websiteId: { type: Schema.Types.ObjectId, default: null },
    subject: { type: { kind: String, id: String }, default: null, _id: false },
    data: { type: Schema.Types.Mixed, default: {} },
    occurredAt: { type: Date, required: true },
    lockedUntil: { type: Date, default: null },
    relayedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
  },
  { strict: 'throw', minimize: false },
);
outboxSchema.index({ eventId: 1 }, { unique: true });
outboxSchema.index({ relayedAt: 1, _id: 1 });
outboxSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OutboxModel = model<OutboxEvent>('OutboxEvent', outboxSchema, 'outbox');

/** Consumer receipts: (consumer, eventId) is processed at most once to completion. */
export interface EventReceipt {
  _id: Types.ObjectId;
  consumer: string;
  eventId: string;
  processedAt: Date;
}
const receiptSchema = new Schema<EventReceipt>(
  {
    consumer: { type: String, required: true, maxlength: 64 },
    eventId: { type: String, required: true },
    processedAt: { type: Date, required: true },
  },
  { strict: 'throw' },
);
receiptSchema.index({ consumer: 1, eventId: 1 }, { unique: true });
receiptSchema.index({ processedAt: 1 }, { expireAfterSeconds: 400 * 86_400 });

export const EventReceiptModel = model<EventReceipt>('EventReceipt', receiptSchema, 'eventReceipts');
