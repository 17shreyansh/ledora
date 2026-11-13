import { Schema, model, type Types } from 'mongoose';

export interface Session {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  /** HMAC of the opaque cookie token; the raw token is never stored. */
  tokenHash: string;
  userAgent: string | null;
  ip: string | null;
  expiresAt: Date;
  lastSeenAt: Date;
  createdAt: Date;
}

const sessionSchema = new Schema<Session>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true },
    userAgent: { type: String, default: null, maxlength: 512 },
    ip: { type: String, default: null, maxlength: 64 },
    expiresAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw' },
);

sessionSchema.index({ tokenHash: 1 }, { unique: true });
sessionSchema.index({ userId: 1 });
// MongoDB removes expired sessions automatically.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SessionModel = model<Session>('Session', sessionSchema, 'sessions');
