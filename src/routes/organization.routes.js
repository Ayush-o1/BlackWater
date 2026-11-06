import { Router } from 'express';
import { Role } from '@prisma/client';
import * as organizationController from '../controllers/organization.controller.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { loginLimiter } from '../middleware/rateLimit.middleware.js';
import { updateOrgSchema, deleteOrgSchema } from '../validators/organization.validators.js';

const router = Router();

router.use(requireAuth);

router.get('/me', organizationController.getOrganization);
router.patch(
  '/me',
  requireRole(Role.ADMIN),
  validateRequest(updateOrgSchema),
  organizationController.updateOrganization
);

// Failed attempts share the login limiter's budget: this route also checks a
// password, so it must not be a way around the limit on guessing one.
router.delete(
  '/me',
  requireRole(Role.ADMIN),
  loginLimiter,
  validateRequest(deleteOrgSchema),
  organizationController.deleteOrganization
);

export default router;
