import { Router } from 'express';
import { ServiceController } from './service.controller';
import { validateRequest } from '../../middleware/validate.middleware';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { Role } from '@prisma/client';
import {
  createServiceSchema,
  updateServiceSchema,
  getServiceSchema,
  deleteServiceSchema,
} from './service.schemas';

const router = Router();

router.use(requireAuth);

router.post(
  '/',
  requireRole(Role.MEMBER, Role.ADMIN),
  validateRequest(createServiceSchema),
  ServiceController.createService
);

router.get(
  '/',
  requireRole(Role.VIEWER, Role.MEMBER, Role.ADMIN),
  ServiceController.listServices
);

router.get(
  '/:id',
  requireRole(Role.VIEWER, Role.MEMBER, Role.ADMIN),
  validateRequest(getServiceSchema),
  ServiceController.getServiceDetails
);

router.patch(
  '/:id',
  requireRole(Role.MEMBER, Role.ADMIN),
  validateRequest(updateServiceSchema),
  ServiceController.updateService
);

router.delete(
  '/:id',
  requireRole(Role.ADMIN), // Only admins can delete services
  validateRequest(deleteServiceSchema),
  ServiceController.deleteService
);

export default router;
