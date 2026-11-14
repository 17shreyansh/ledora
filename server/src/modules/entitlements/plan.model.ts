import { Schema, model, type Types } from 'mongoose';

export const LIMIT_KEYS = ['websites', 'monthlyEvents', 'analyticsRetentionDays', 'teamMembers'] as const;
export type LimitKey = (typeof LIMIT_KEYS)[number];
export type Limits = Record<LimitKey, number>;

export interface Plan {
  _id: Types.ObjectId;
  key: string;
  name: string;
  limits: Limits;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const planSchema = new Schema<Plan>(
  {
    key: { type: String, required: true, maxlength: 32 },
    name: { type: String, required: true, maxlength: 64 },
    limits: {
      websites: { type: Number, required: true, min: 0 },
      monthlyEvents: { type: Number, required: true, min: 0 },
      analyticsRetentionDays: { type: Number, required: true, min: 1 },
      teamMembers: { type: Number, required: true, min: 1 },
    },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true, strict: 'throw' },
);
planSchema.index({ key: 1 }, { unique: true });

export const PlanModel = model<Plan>('Plan', planSchema, 'plans');

/**
 * Initial catalogue. These are seeded into the `plans` collection only when a plan is
 * missing, so limits are edited in the database (admin app, Phase 9), never by a deploy.
 * Prices are not here: billing is a separate concern.
 */
export const DEFAULT_PLANS: ReadonlyArray<Pick<Plan, 'key' | 'name' | 'limits' | 'sortOrder'>> = [
  { key: 'free', name: 'Free', sortOrder: 0, limits: { websites: 1, monthlyEvents: 10_000, analyticsRetentionDays: 30, teamMembers: 2 } },
  { key: 'starter', name: 'Starter', sortOrder: 1, limits: { websites: 3, monthlyEvents: 100_000, analyticsRetentionDays: 365, teamMembers: 5 } },
  { key: 'growth', name: 'Growth', sortOrder: 2, limits: { websites: 10, monthlyEvents: 500_000, analyticsRetentionDays: 730, teamMembers: 15 } },
  { key: 'business', name: 'Business', sortOrder: 3, limits: { websites: 50, monthlyEvents: 2_000_000, analyticsRetentionDays: 1095, teamMembers: 50 } },
  { key: 'enterprise', name: 'Enterprise', sortOrder: 4, limits: { websites: 500, monthlyEvents: 20_000_000, analyticsRetentionDays: 1825, teamMembers: 500 } },
];

export async function seedDefaultPlans(): Promise<void> {
  await PlanModel.bulkWrite(
    DEFAULT_PLANS.map((p) => ({
      updateOne: { filter: { key: p.key }, update: { $setOnInsert: { ...p, active: true } }, upsert: true },
    })),
  );
}
