import { z } from 'zod';
import { validateSlug } from '../slug.js';
import { isValidTimeZone } from '../timezones.js';

export const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid identifier');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Enter your email address')
  .max(254, 'Email address is too long')
  .pipe(z.email('Enter a valid email address'));

/** NIST 800-63B style: length over composition rules. */
export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(128, 'Use at most 128 characters');

export const personNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter your name')
  .max(80, 'Name is too long');

const SLUG_MESSAGES = {
  too_short: 'Use at least 3 characters',
  too_long: 'Use at most 48 characters',
  invalid_characters: 'Use lowercase letters, numbers and single hyphens',
  reserved: 'This address is reserved',
} as const;

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .superRefine((value, ctx) => {
    const problem = validateSlug(value);
    if (problem) ctx.addIssue({ code: 'custom', message: SLUG_MESSAGES[problem] });
  });

export const timeZoneSchema = z
  .string()
  .min(1)
  .max(64)
  .refine(isValidTimeZone, 'Unknown time zone');
