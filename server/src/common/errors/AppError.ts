import type { ErrorCode } from '@ledora/shared';

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(message: string, fields?: Record<string, string>) {
    return new AppError(400, 'BAD_REQUEST', message, fields);
  }
  static unauthenticated(message = 'Sign in to continue') {
    return new AppError(401, 'UNAUTHENTICATED', message);
  }
  static forbidden(message = 'You do not have permission to do that') {
    return new AppError(403, 'FORBIDDEN', message);
  }
  /** Used for missing *and* not-yours resources so existence is never leaked across tenants. */
  static notFound(message = 'Not found') {
    return new AppError(404, 'NOT_FOUND', message);
  }
  static conflict(message: string, fields?: Record<string, string>) {
    return new AppError(409, 'CONFLICT', message, fields);
  }
}
