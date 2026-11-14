import { Schema, model, type Types } from 'mongoose';

/**
 * Raw analytics events (high volume). Kept separate from business data, bounded,
 * PII-free (no IP, no raw user agent, no query strings except utm_*), and expired per
 * the organization's plan retention via `expiresAt`. Access goes through the ingest
 * and (Phase 3) analytics repositories so storage can later move to ClickHouse.
 */
export interface AnalyticsEvent {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  websiteId: Types.ObjectId;
  eventId: string;
  type: 'pageview' | 'event';
  name: string | null;
  /** Event time (client clock, validated and clamped). */
  ts: Date;
  receivedAt: Date;
  visitorId: string;
  sessionId: string;
  host: string;
  path: string;
  utm: { source?: string; medium?: string; campaign?: string; term?: string; content?: string } | null;
  referrerHost: string | null;
  referrerPath: string | null;
  device: { type: 'desktop' | 'mobile' | 'tablet' | 'other'; browser: string; os: string };
  screen: { w: number; h: number } | null;
  lang: string | null;
  props: Record<string, string | number | boolean | null> | null;
  sdkVersion: string;
  expiresAt: Date;
}

const analyticsEventSchema = new Schema<AnalyticsEvent>(
  {
    orgId: { type: Schema.Types.ObjectId, required: true },
    websiteId: { type: Schema.Types.ObjectId, required: true },
    eventId: { type: String, required: true },
    type: { type: String, enum: ['pageview', 'event'], required: true },
    name: { type: String, default: null },
    ts: { type: Date, required: true },
    receivedAt: { type: Date, required: true },
    visitorId: { type: String, required: true },
    sessionId: { type: String, required: true },
    host: { type: String, required: true },
    path: { type: String, required: true },
    utm: { type: Schema.Types.Mixed, default: null },
    referrerHost: { type: String, default: null },
    referrerPath: { type: String, default: null },
    device: { type: { type: String }, browser: String, os: String },
    screen: { type: { w: Number, h: Number }, default: null, _id: false },
    lang: { type: String, default: null },
    props: { type: Schema.Types.Mixed, default: null },
    sdkVersion: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { strict: 'throw', versionKey: false },
);

analyticsEventSchema.index({ websiteId: 1, eventId: 1 }, { unique: true });
analyticsEventSchema.index({ websiteId: 1, ts: -1 });
analyticsEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AnalyticsEventModel = model<AnalyticsEvent>('AnalyticsEvent', analyticsEventSchema, 'analyticsEvents');
