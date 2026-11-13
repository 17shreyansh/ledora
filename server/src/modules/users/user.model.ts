import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export interface User {
  _id: Types.ObjectId;
  email: string;
  name: string;
  passwordHash: string;
  emailVerifiedAt: Date | null;
  status: 'active' | 'disabled';
  /** Bumped on password change/reset; sessions created before it are invalid. */
  passwordChangedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<User>(
  {
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    passwordHash: { type: String, required: true, select: false },
    emailVerifiedAt: { type: Date, default: null },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
    passwordChangedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: 'throw' },
);

userSchema.index({ email: 1 }, { unique: true });

export const UserModel = model<User>('User', userSchema, 'users');
export type UserDoc = HydratedDocument<User>;
