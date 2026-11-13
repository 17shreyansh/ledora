import type { Types } from 'mongoose';
import type { ClientSession } from 'mongoose';
import { logger, requestStore } from '../../common/logger.js';
import { AuditLogModel } from './auditLog.model.js';

export interface AuditEntry {
  action: string;
  orgId?: Types.ObjectId | null;
  actorId?: Types.ObjectId | null;
  target?: { type: string; id: string | Types.ObjectId | null };
  metadata?: Record<string, unknown>;
  ip?: string | null;
}

export class AuditService {
  constructor(private readonly retentionDays: number) {}

  /**
   * Records an audit entry. When `session` is given the entry commits atomically
   * with the change it describes; otherwise a failure is logged, not thrown, so an
   * audit hiccup cannot undo a change that already happened.
   */
  async record(entry: AuditEntry, session?: ClientSession): Promise<void> {
    const doc = {
      orgId: entry.orgId ?? null,
      actorType: entry.actorId ? 'user' : 'system',
      actorId: entry.actorId ?? null,
      action: entry.action,
      targetType: entry.target?.type ?? null,
      targetId: entry.target?.id ? String(entry.target.id) : null,
      metadata: entry.metadata ?? {},
      ip: entry.ip ?? null,
      requestId: requestStore.getStore()?.requestId ?? null,
      expiresAt: new Date(Date.now() + this.retentionDays * 86_400_000),
    };
    if (session) {
      await AuditLogModel.create([doc], { session });
      return;
    }
    try {
      await AuditLogModel.create(doc);
    } catch (err) {
      logger.error({ err, action: entry.action }, 'Failed to write audit log entry');
    }
  }
}
