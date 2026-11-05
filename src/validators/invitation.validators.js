import { z } from 'zod';
import { Role } from '@prisma/client';
import { emailField, newPasswordField, personNameField, uuid } from './common.validators.js';

// Tokens are 32 random bytes in base64url, which is 43 characters. The exact
// length is not enforced; only a sane range, to reject junk early.
const tokenField = z.string().min(20, 'Invalid invitation token').max(200, 'Invalid invitation token');

export const createInvitationSchema = z.object({
  // ADMIN is deliberately not offered: invitations only create MEMBER or VIEWER.
  // The database also refuses an ADMIN invitation (CHECK constraint).
  body: z.object({ role: z.enum([Role.MEMBER, Role.VIEWER]) }),
});

export const revokeInvitationSchema = z.object({
  params: z.object({ id: uuid('invitation ID') }),
});

export const previewInvitationSchema = z.object({
  body: z.object({ token: tokenField }),
});

export const acceptInvitationSchema = z.object({
  body: z.object({
    token: tokenField,
    name: personNameField,
    email: emailField,
    password: newPasswordField,
  }),
});
