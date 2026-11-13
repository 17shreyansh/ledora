import { ApiError } from '../../api/client';

/** A short, human title for errors from member and invitation actions. */
export function memberErrorTitle(error: unknown): string | undefined {
  if (!(error instanceof ApiError)) return undefined;
  switch (error.code) {
    case 'LAST_OWNER':
      return 'An owner is required';
    case 'FORBIDDEN':
      return 'Not allowed';
    case 'NOT_FOUND':
      return 'This member is no longer in the organization';
    case 'CONFLICT':
      return 'Couldn’t complete that';
    case 'RATE_LIMITED':
      return 'Too many requests';
    default:
      return undefined;
  }
}
