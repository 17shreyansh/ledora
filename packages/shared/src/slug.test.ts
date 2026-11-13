import { describe, expect, it } from 'vitest';
import { slugify, validateSlug } from './slug.js';

describe('slugs', () => {
  it('slugifies names', () => {
    expect(slugify('  Acme Café & Co.  ')).toBe('acme-cafe-co');
  });
  it('rejects reserved routes', () => {
    for (const s of ['login', 'pricing', 'admin', 'api', 'signup']) expect(validateSlug(s)).toBe('reserved');
  });
  it('rejects invalid shapes', () => {
    expect(validateSlug('ab')).toBe('too_short');
    expect(validateSlug('-acme')).toBe('invalid_characters');
    expect(validateSlug('ac--me')).toBe('invalid_characters');
    expect(validateSlug('Acme')).toBe('invalid_characters');
    expect(validateSlug('acme-co')).toBeNull();
  });
});
