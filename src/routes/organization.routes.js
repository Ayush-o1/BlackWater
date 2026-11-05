import { Router } from 'express';
import { Role } from '@prisma/client';
import * as organizationController from '../controllers/organization.controller.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { updateOrgSchema } from '../validators/organization.validators.js';

const router = Router();

router.use(requireAuth);

router.get('/me', organizationController.getOrganization);
router.patch(
  '/me',
  requireRole(Role.ADMIN),
  validateRequest(updateOrgSchema),
  organizationController.updateOrganization
);

export default router;
