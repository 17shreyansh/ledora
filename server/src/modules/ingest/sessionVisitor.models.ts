import { Schema, model, type Types } from 'mongoose';

/**
 * One document per SDK session, maintained incrementally at ingestion. Bounded
 * (counters, not arrays) and expired with the same retention as raw events.
 */
export interface AnalyticsSession {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  websiteId: Types.ObjectId;
  sessionId: string;
  visitorId: string;
  startedAt: Date;
  endedAt: Date;
  pageviews: number;
  events: number;
  entryPath: string;
  exitPath: string;
  referrerHost: string | null;
  utm: { source?: string; medium?: string; campaign?: string } | null;
  device: { type: string; browser: string; os: string };
  expiresAt: Date;
}

const sessionSchema = new Schema<AnalyticsSession>(
  {
    orgId: { type: Schema.Types.ObjectId, required: true },
    websiteId: { type: Schema.Types.ObjectId, required: true },
    sessionId: { type: String, required: true },
    visitorId: { type: String, required: true },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, required: true },
    pageviews: { type: Number, default: 0 },
    events: { type: Number, default: 0 },
    entryPath: { type: String, required: true },
    exitPath: { type: String, required: true },
    referrerHost: { type: String, default: null },
    utm: { type: Schema.Types.Mixed, default: null },
    device: { type: { type: String }, browser: String, os: String },
    expiresAt: { type: Date, required: true },
  },
  { strict: 'throw', versionKey: false },
);
sessionSchema.index({ websiteId: 1, sessionId: 1 }, { unique: true });
sessionSchema.index({ websiteId: 1, startedAt: -1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AnalyticsSessionModel = model<AnalyticsSession>('AnalyticsSession', sessionSchema, 'analyticsSessions');

/** First/last sighting per visitor and website — powers "new visitors". */
export interface AnalyticsVisitor {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  websiteId: Types.ObjectId;
  visitorId: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
}

const visitorSchema = new Schema<AnalyticsVisitor>(
  {
    orgId: { type: Schema.Types.ObjectId, required: true },
    websiteId: { type: Schema.Types.ObjectId, required: true },
    visitorId: { type: String, required: true },
    firstSeenAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { strict: 'throw', versionKey: false },
);
visitorSchema.index({ websiteId: 1, visitorId: 1 }, { unique: true });
visitorSchema.index({ websiteId: 1, firstSeenAt: -1 });
visitorSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AnalyticsVisitorModel = model<AnalyticsVisitor>('AnalyticsVisitor', visitorSchema, 'analyticsVisitors');
