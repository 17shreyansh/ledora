import type { z } from 'zod';
import { AppError } from './errors/AppError.js';

/** Parse untrusted input or throw a 400 with field-level messages. */
export function parse<T extends z.ZodType>(schema: T, data: unknown): z.output<T> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  throw validationError(result.error);
}

export function validationError(error: z.ZodError): AppError {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    fields[key] ??= issue.message;
  }
  return new AppError(400, 'VALIDATION_FAILED', 'Some fields need attention', fields);
}
