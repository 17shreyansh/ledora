import { Schema, model, type Types } from 'mongoose';

export interface Website {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  name: string;
  /** Primary hostname, e.g. "shop.example.com". */
  domain: string;
  /** Hostnames or "*.example.com" patterns events may come from (bounded, ≤ 20). */
  allowedDomains: string[];
  /** Public identifier embedded in the snippet. Not a secret, never an auth credential. */
  siteKey: string;
  tracking: { consentRequired: boolean; respectDoNotTrack: boolean };
  installation: {
    firstSeenAt: Date | null;
    lastSeenAt: Date | null;
    sdkVersion: string | null;
  };
  status: 'active' | 'deleted';
  createdBy: Types.ObjectId;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const websiteSchema = new Schema<Website>(
  {
    orgId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    domain: { type: String, required: true, lowercase: true, maxlength: 253 },
    allowedDomains: {
      type: [{ type: String, lowercase: true, maxlength: 255 }],
      validate: { validator: (v: string[]) => v.length >= 1 && v.length <= 20, message: '1–20 allowed domains' },
    },
    siteKey: { type: String, required: true },
    tracking: {
      consentRequired: { type: Boolean, default: false },
      respectDoNotTrack: { type: Boolean, default: true },
    },
    installation: {
      firstSeenAt: { type: Date, default: null },
      lastSeenAt: { type: Date, default: null },
      sdkVersion: { type: String, default: null, maxlength: 32 },
    },
    status: { type: String, enum: ['active', 'deleted'], default: 'active' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, strict: 'throw' },
);

websiteSchema.index({ siteKey: 1 }, { unique: true });
websiteSchema.index({ orgId: 1, status: 1, createdAt: 1 });

export const WebsiteModel = model<Website>('Website', websiteSchema, 'websites');
