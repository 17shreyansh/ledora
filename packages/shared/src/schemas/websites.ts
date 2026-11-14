import { z } from 'zod';
import { INGEST_LIMITS, INGEST_SCHEMA_VERSION, SITE_KEY_PATTERN } from '../ingest-contract.js';

const HOSTNAME = /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))*$/;

/** Accepts "example.com", "https://www.example.com/path" etc. and returns the bare hostname. */
export function normalizeHostname(input: string): string {
  let v = input.trim().toLowerCase();
  v = v.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  v = v.split(/[/?#]/)[0] ?? '';
  v = v.replace(/:\d+$/, '').replace(/\.$/, '');
  return v;
}

export function isValidHostname(host: string): boolean {
  if (host === 'localhost') return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')) return false; // IPs are not allowed
  return HOSTNAME.test(host) && host.includes('.');
}

export const hostnameSchema = z
  .string()
  .max(300)
  .transform(normalizeHostname)
  .refine(isValidHostname, 'Enter a domain like example.com');

/** A hostname or a wildcard for its subdomains: "*.example.com". */
export const domainPatternSchema = z
  .string()
  .max(300)
  .transform((v) => {
    const t = v.trim().toLowerCase();
    return t.startsWith('*.') ? `*.${normalizeHostname(t.slice(2))}` : normalizeHostname(t);
  })
  .refine((v) => isValidHostname(v.startsWith('*.') ? v.slice(2) : v), 'Enter a domain like example.com or *.example.com');

/** True if `host` is allowed by any pattern ("*.example.com" also matches "example.com"). */
export function hostMatchesPatterns(host: string, patterns: readonly string[]): boolean {
  const h = host.toLowerCase();
  return patterns.some((p) => {
    if (p.startsWith('*.')) {
      const base = p.slice(2);
      return h === base || h.endsWith(`.${base}`);
    }
    return h === p;
  });
}

export const MAX_ALLOWED_DOMAINS = 20;

export const createWebsiteSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(80),
  domain: hostnameSchema,
});
export type CreateWebsiteInput = z.infer<typeof createWebsiteSchema>;

export const updateWebsiteSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    allowedDomains: z
      .array(domainPatternSchema)
      .min(1, 'Add at least one domain')
      .max(MAX_ALLOWED_DOMAINS, `At most ${MAX_ALLOWED_DOMAINS} domains`)
      .transform((list) => [...new Set(list)]),
    tracking: z
      .object({ consentRequired: z.boolean(), respectDoNotTrack: z.boolean() })
      .partial(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdateWebsiteInput = z.infer<typeof updateWebsiteSchema>;

// ── Public ingestion (server-side validation of the SDK contract) ──

const short = (max: number) => z.string().max(max);
const propValue = z.union([short(INGEST_LIMITS.maxPropValueLength), z.number().finite(), z.boolean(), z.null()]);

export const ingestEventSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9-]{8,64}$/),
  type: z.enum(['pageview', 'event']),
  name: z.string().trim().min(1).max(INGEST_LIMITS.maxNameLength).regex(/^[\w .:/-]+$/).optional(),
  ts: z.number().int().positive(),
  url: z.url({ protocol: /^https?$/ }).max(INGEST_LIMITS.maxUrlLength),
  referrer: z.string().max(INGEST_LIMITS.maxUrlLength).optional(),
  visitorId: z.string().regex(/^[A-Za-z0-9-]{8,64}$/),
  sessionId: z.string().regex(/^[A-Za-z0-9-]{8,64}$/),
  props: z
    .record(z.string().max(INGEST_LIMITS.maxPropKeyLength).regex(/^[\w.-]+$/), propValue)
    .refine((o) => Object.keys(o).length <= INGEST_LIMITS.maxProps, `At most ${INGEST_LIMITS.maxProps} properties`)
    .optional(),
  screen: z.object({ w: z.number().int().min(0).max(20000), h: z.number().int().min(0).max(20000) }).optional(),
  lang: z.string().max(35).regex(/^[A-Za-z0-9-]+$/).optional(),
}).refine((e) => e.type !== 'event' || Boolean(e.name), { message: 'Custom events need a name', path: ['name'] });

export const ingestBatchHeaderSchema = z.object({
  v: z.literal(INGEST_SCHEMA_VERSION),
  siteKey: z.string().regex(SITE_KEY_PATTERN),
  sdkVersion: z.string().max(32).regex(/^[\w.+-]+$/),
  automated: z.boolean().optional(),
  // Validated one by one so a single bad event does not drop the whole batch.
  events: z.array(z.unknown()).min(1).max(INGEST_LIMITS.maxEventsPerBatch),
});
