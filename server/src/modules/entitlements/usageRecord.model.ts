import { Schema, model, type Types } from 'mongoose';

/** Durable monthly usage per organization (one small document per org per month). */
export interface UsageRecord {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  /** UTC calendar month, "YYYY-MM". */
  period: string;
  events: number;
  updatedAt: Date;
}

const usageRecordSchema = new Schema<UsageRecord>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    period: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
    events: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: false, updatedAt: true }, strict: 'throw' },
);
usageRecordSchema.index({ orgId: 1, period: 1 }, { unique: true });

export const UsageRecordModel = model<UsageRecord>('UsageRecord', usageRecordSchema, 'usageRecords');

export function usagePeriod(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}
