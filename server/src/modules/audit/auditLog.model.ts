import { Schema, model, type Types } from 'mongoose';

export interface AuditLog {
  _id: Types.ObjectId;
  orgId: Types.ObjectId | null;
  actorType: 'user' | 'system';
  actorId: Types.ObjectId | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  /** Small, non-sensitive context only. Never passwords, tokens or message bodies. */
  metadata: Record<string, unknown>;
  ip: string | null;
  requestId: string | null;
  createdAt: Date;
  /** Retention boundary; a TTL index removes the entry after this time. */
  expiresAt: Date;
}

const auditLogSchema = new Schema<AuditLog>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null },
    actorType: { type: String, enum: ['user', 'system'], required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    action: { type: String, required: true, maxlength: 64 },
    targetType: { type: String, default: null, maxlength: 32 },
    targetId: { type: String, default: null, maxlength: 64 },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ip: { type: String, default: null, maxlength: 64 },
    requestId: { type: String, default: null, maxlength: 64 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw', minimize: false },
);

auditLogSchema.index({ orgId: 1, _id: -1 });
auditLogSchema.index({ actorId: 1, _id: -1 });
auditLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AuditLogModel = model<AuditLog>('AuditLog', auditLogSchema, 'auditLogs');
