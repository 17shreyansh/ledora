import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from '../api/client';

/**
 * Copies field-level messages from an API error (`error.fields`, keyed by dotted path) onto
 * react-hook-form fields so they render inline. Only the given field names are mapped; the
 * return value says whether any field message was applied, so callers can decide whether a
 * form-level alert is still needed.
 */
export function applyApiFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fieldNames: readonly Path<T>[],
): boolean {
  if (!(error instanceof ApiError) || !error.fields) return false;
  const known = new Set<string>(fieldNames);
  let applied = false;
  for (const [path, message] of Object.entries(error.fields)) {
    if (!known.has(path)) continue;
    setError(path as Path<T>, { type: 'server', message }, { shouldFocus: !applied });
    applied = true;
  }
  return applied;
}

/** True when the error carries a field message for one of `fieldNames` (shown inline instead of an alert). */
export function hasFieldErrors(error: unknown, fieldNames: readonly string[]): boolean {
  if (!(error instanceof ApiError) || !error.fields) return false;
  return Object.keys(error.fields).some((path) => fieldNames.includes(path));
}
