import { z } from 'zod';
import { ORG_ROLES } from '../roles.js';
import { emailSchema, slugSchema, timeZoneSchema } from './common.js';

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2, 'Use at least 2 characters').max(80, 'Name is too long'),
  slug: slugSchema.optional(),
  timezone: timeZoneSchema.default('UTC'),
});
export type CreateOrganizationInput = z.input<typeof createOrganizationSchema>;

export const updateOrganizationSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    slug: slugSchema,
    timezone: timeZoneSchema,
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

export const orgRoleSchema = z.enum(ORG_ROLES);

export const createInvitationSchema = z.object({
  email: emailSchema,
  role: orgRoleSchema,
});
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

export const updateMemberRoleSchema = z.object({
  role: orgRoleSchema,
});
