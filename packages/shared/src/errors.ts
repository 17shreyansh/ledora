/** Stable machine-readable error codes returned by the API. */
export const ERROR_CODES = [
  'BAD_REQUEST',
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'CSRF_FAILED',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'EMAIL_NOT_VERIFIED',
  'INVALID_CREDENTIALS',
  'TOKEN_INVALID',
  'LAST_OWNER',
  'PAYLOAD_TOO_LARGE',
  'INTERNAL',
  'SERVICE_UNAVAILABLE',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    /** Field-level validation issues, keyed by dotted path. */
    fields?: Record<string, string>;
    requestId?: string;
  };
}
