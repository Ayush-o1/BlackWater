import { Router } from 'express';
import { OrganizationController } from './organization.controller';
import { validateRequest } from '../../middleware/validate.middleware';
import { updateOrgSchema } from './organization.schemas';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { Role } from '@prisma/client';

const router = Router();

// All organization routes require authentication
router.use(requireAuth);

router.get('/me', OrganizationController.getOrgDetails);

// Only ADMINs can mutate the organization
router.patch(
  '/me', 
  requireRole(Role.ADMIN), 
  validateRequest(updateOrgSchema), 
  OrganizationController.updateOrg
);

export default router;
