import { ApiError } from '../../api/client';

/** A short, human title for errors from website actions. */
export function websiteErrorTitle(error: unknown): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  switch (error.code) {
    case 'PLAN_LIMIT':
      return 'Your plan’s website limit is reached';
    case 'CONFLICT':
      return 'That website already exists';
    case 'FORBIDDEN':
      return 'Not allowed';
    case 'NOT_FOUND':
      return 'This website no longer exists';
    case 'RATE_LIMITED':
      return 'Too many requests';
    default:
      return undefined;
  }
}

export function isPlanLimitError(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'PLAN_LIMIT';
}
