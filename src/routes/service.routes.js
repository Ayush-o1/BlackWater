import { Router } from 'express';
import { Role } from '@prisma/client';
import * as serviceController from '../controllers/service.controller.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import {
  createServiceSchema,
  updateServiceSchema,
  getServiceSchema,
  deleteServiceSchema,
  listServicesSchema,
} from '../validators/service.validators.js';

const router = Router();

const canRead = requireRole(Role.VIEWER, Role.MEMBER, Role.ADMIN);
const canWrite = requireRole(Role.MEMBER, Role.ADMIN);

router.use(requireAuth);

router.post('/', canWrite, validateRequest(createServiceSchema), serviceController.createService);
router.get('/', canRead, validateRequest(listServicesSchema), serviceController.listServices);
router.get('/:id', canRead, validateRequest(getServiceSchema), serviceController.getServiceDetails);
router.patch('/:id', canWrite, validateRequest(updateServiceSchema), serviceController.updateService);
// Deleting a service removes it from past incidents too, so only admins may do it.
router.delete('/:id', requireRole(Role.ADMIN), validateRequest(deleteServiceSchema), serviceController.deleteService);

export default router;
