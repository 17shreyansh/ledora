import { randomUUID } from 'node:crypto';
import type { ClientSession, Types } from 'mongoose';
import { requestStore } from '../../common/logger.js';
import { OutboxModel } from './outbox.model.js';

/** Catalogue of business events with their current schema version. */
export const EVENT_TYPES = {
  'website.installation_verified': 1,
} as const;
export type EventType = keyof typeof EVENT_TYPES;

export interface EventEnvelope {
  id: string;
  type: EventType;
  version: number;
  occurredAt: string;
  orgId: string;
  websiteId: string | null;
  subject: { kind: string; id: string } | null;
  correlationId: string | null;
  data: Record<string, unknown>;
}

export interface EmitInput {
  type: EventType;
  orgId: Types.ObjectId;
  websiteId?: Types.ObjectId | null;
  subject?: { kind: string; id: string } | null;
  data?: Record<string, unknown>;
}

/** Writes a business event to the outbox inside the caller's transaction. */
export async function emitEvent(session: ClientSession, input: EmitInput): Promise<string> {
  const eventId = randomUUID();
  await OutboxModel.create(
    [
      {
        eventId,
        type: input.type,
        version: EVENT_TYPES[input.type],
        orgId: input.orgId,
        websiteId: input.websiteId ?? null,
        subject: input.subject ?? null,
        data: { ...(input.data ?? {}), correlationId: requestStore.getStore()?.requestId ?? null },
        occurredAt: new Date(),
      },
    ],
    { session },
  );
  return eventId;
}
