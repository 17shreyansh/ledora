import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** 256-bit URL-safe random token. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/**
 * Tokens are stored only as keyed hashes, so a database leak does not yield usable
 * session, verification or invitation tokens.
 */
export function hashToken(secret: string, token: string, purpose: string): string {
  return createHmac('sha256', secret).update(`${purpose}:${token}`).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
