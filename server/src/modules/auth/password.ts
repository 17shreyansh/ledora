import { hash, verify } from '@node-rs/argon2';

// Argon2id with the library defaults (m=19 MiB, t=2, p=1), the OWASP-recommended baseline.
export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/**
 * Verifying against a fixed hash when the account does not exist keeps response
 * times similar for known and unknown emails (account-enumeration defence).
 */
let dummyHash: Promise<string> | null = null;
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hash('ledora-timing-equaliser-not-a-real-password');
  await verifyPassword(await dummyHash, password);
}
