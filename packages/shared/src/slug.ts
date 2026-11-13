/**
 * Organization slugs become part of public URLs (ledora.com/{org}/{form}),
 * so they must never collide with first-party routes.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  'about', 'account', 'admin', 'api', 'app', 'assets', 'auth', 'billing', 'blog', 'careers',
  'cdn', 'changelog', 'contact', 'dashboard', 'docs', 'download', 'embed', 'f', 'features',
  'form', 'forms', 'help', 'home', 'invite', 'invitations', 'join', 'legal', 'login', 'logout',
  'new', 'oauth', 'onboarding', 'org', 'orgs', 'organizations', 'press', 'pricing', 'privacy',
  'register', 'reset', 'robots.txt', 'sdk', 'security', 'settings', 'signin', 'signout',
  'signup', 'sitemap.xml', 'static', 'status', 'support', 'terms', 'verify', 'widget', 'www',
  'ledora', 'favicon.ico', 'health', 'healthz', 'readyz', 'well-known', '.well-known',
]);

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;
export const SLUG_MIN = 3;
export const SLUG_MAX = 48;

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, '');
}

export type SlugProblem = 'too_short' | 'too_long' | 'invalid_characters' | 'reserved';

export function validateSlug(slug: string): SlugProblem | null {
  if (slug.length < SLUG_MIN) return 'too_short';
  if (slug.length > SLUG_MAX) return 'too_long';
  if (!SLUG_PATTERN.test(slug) || slug.includes('--')) return 'invalid_characters';
  if (RESERVED_SLUGS.has(slug)) return 'reserved';
  return null;
}
