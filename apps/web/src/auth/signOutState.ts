/**
 * Remembers whether the session ended because the user signed out (as opposed to the
 * session expiring), so guards do not attach a "return to" link after a deliberate sign-out.
 */
let signedOutIntentionally = false;

export function markSignedOut(): void {
  signedOutIntentionally = true;
}

export function clearSignedOut(): void {
  signedOutIntentionally = false;
}

export function wasSignedOutIntentionally(): boolean {
  return signedOutIntentionally;
}
