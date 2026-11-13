import { Types } from 'mongoose';
import { AppError } from '../errors/AppError.js';

/** Opaque cursor over ObjectId order. Clients must treat it as an opaque string. */
export function encodeCursor(id: Types.ObjectId): string {
  return Buffer.from(id.toHexString(), 'hex').toString('base64url');
}

export function decodeCursor(cursor: string | undefined): Types.ObjectId | null {
  if (!cursor) return null;
  const hex = Buffer.from(cursor, 'base64url').toString('hex');
  if (!/^[a-f0-9]{24}$/.test(hex)) throw AppError.badRequest('Invalid cursor');
  return new Types.ObjectId(hex);
}
