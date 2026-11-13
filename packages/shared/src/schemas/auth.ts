import { z } from 'zod';
import { emailSchema, passwordSchema, personNameSchema } from './common.js';

export const registerSchema = z.object({
  name: personNameSchema,
  email: emailSchema,
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  // Do not apply the length policy on login: older passwords may predate it.
  password: z.string().min(1, 'Enter your password').max(256),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const tokenSchema = z.object({
  token: z.string().min(20).max(200),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: passwordSchema,
});

export const updateProfileSchema = z.object({
  name: personNameSchema,
});
