import { Schema, model, type Types } from 'mongoose';

export const AUTH_TOKEN_TYPES = ['email_verification', 'password_reset'] as const;
export type AuthTokenType = (typeof AUTH_TOKEN_TYPES)[number];

export interface AuthToken {
  _id: Types.ObjectId;
  type: AuthTokenType;
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

const authTokenSchema = new Schema<AuthToken>(
  {
    type: { type: String, enum: AUTH_TOKEN_TYPES, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: 'throw' },
);

authTokenSchema.index({ tokenHash: 1 }, { unique: true });
authTokenSchema.index({ userId: 1, type: 1 });
authTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AuthTokenModel = model<AuthToken>('AuthToken', authTokenSchema, 'authTokens');
