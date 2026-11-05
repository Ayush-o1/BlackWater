import { Router } from 'express';
import { Role } from '@prisma/client';
import * as invitationController from '../controllers/invitation.controller.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { authLimiter } from '../middleware/rateLimit.middleware.js';
import {
  createInvitationSchema,
  revokeInvitationSchema,
  previewInvitationSchema,
  acceptInvitationSchema,
} from '../validators/invitation.validators.js';

const router = Router();

// Public: the invitee has no account yet, so these cannot require a login.
// They take the token in a POST body (not the URL) so it stays out of access
// logs, and share the strict login/registration rate limit because they can be
// guessed at.
router.post('/preview', authLimiter, validateRequest(previewInvitationSchema), invitationController.previewInvitation);
router.post('/accept', authLimiter, validateRequest(acceptInvitationSchema), invitationController.acceptInvitation);

// Admin only: managing who may join the caller's organization.
router.use(requireAuth, requireRole(Role.ADMIN));
router.post('/', validateRequest(createInvitationSchema), invitationController.createInvitation);
router.get('/', invitationController.listInvitations);
router.delete('/:id', validateRequest(revokeInvitationSchema), invitationController.revokeInvitation);

export default router;
