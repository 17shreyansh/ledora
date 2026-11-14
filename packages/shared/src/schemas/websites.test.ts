import { describe, expect, it } from 'vitest';
import { createWebsiteSchema, domainPatternSchema, hostMatchesPatterns, ingestEventSchema } from './websites.js';

describe('website domains', () => {
  it('normalizes pasted URLs to hostnames', () => {
    expect(createWebsiteSchema.parse({ name: 'Shop', domain: 'https://WWW.Example.com/path?x=1' }).domain).toBe('www.example.com');
  });
  it('rejects IPs and garbage', () => {
    for (const d of ['10.0.0.1', '[::1]', 'not a domain', 'example', '-bad.com']) {
      expect(createWebsiteSchema.safeParse({ name: 'x', domain: d }).success).toBe(false);
    }
  });
  it('supports wildcard subdomain patterns', () => {
    const p = domainPatternSchema.parse('*.Example.com');
    expect(p).toBe('*.example.com');
    expect(hostMatchesPatterns('shop.example.com', [p])).toBe(true);
    expect(hostMatchesPatterns('example.com', [p])).toBe(true);
    expect(hostMatchesPatterns('evilexample.com', [p])).toBe(false);
    expect(hostMatchesPatterns('example.com.evil.net', [p])).toBe(false);
  });
});

describe('ingest events', () => {
  const base = { id: 'evt-12345678', type: 'pageview', ts: Date.now(), url: 'https://example.com/', visitorId: 'v-12345678', sessionId: 's-12345678' };
  it('accepts a valid pageview', () => expect(ingestEventSchema.safeParse(base).success).toBe(true));
  it('requires a name for custom events', () => expect(ingestEventSchema.safeParse({ ...base, type: 'event' }).success).toBe(false));
  it('rejects non-http URLs and nested props', () => {
    expect(ingestEventSchema.safeParse({ ...base, url: 'javascript:alert(1)' }).success).toBe(false);
    expect(ingestEventSchema.safeParse({ ...base, props: { a: { b: 1 } } }).success).toBe(false);
  });
});
