import { Router } from 'express';
import { Role } from '@prisma/client';
import * as incidentController from '../controllers/incident.controller.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import {
  createIncidentSchema,
  listIncidentsSchema,
  getIncidentSchema,
  assignIncidentSchema,
  addUpdateSchema,
  changeStatusSchema,
} from '../validators/incident.validators.js';

const router = Router();

const canRead = requireRole(Role.VIEWER, Role.MEMBER, Role.ADMIN);
const canWrite = requireRole(Role.MEMBER, Role.ADMIN);

router.use(requireAuth);

router.get('/', canRead, validateRequest(listIncidentsSchema), incidentController.listIncidents);
router.post('/', canWrite, validateRequest(createIncidentSchema), incidentController.createIncident);
router.get('/:id', canRead, validateRequest(getIncidentSchema), incidentController.getIncidentDetails);
router.patch('/:id/assign', canWrite, validateRequest(assignIncidentSchema), incidentController.assignIncident);
router.patch('/:id/status', canWrite, validateRequest(changeStatusSchema), incidentController.updateStatus);
router.post('/:id/updates', canWrite, validateRequest(addUpdateSchema), incidentController.addUpdate);

export default router;
