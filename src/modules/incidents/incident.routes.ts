import { Router } from 'express';
import { IncidentController } from './incident.controller';
import { validateRequest } from '../../middleware/validate.middleware';
import { requireAuth } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { Role } from '@prisma/client';
import {
  createIncidentSchema,
  listIncidentsSchema,
  assignIncidentSchema,
  addUpdateSchema,
  changeStatusSchema,
  getIncidentSchema,
} from './incident.schemas';

const router = Router();

// All incident routes are protected
router.use(requireAuth);

// List Incidents (VIEWER, MEMBER, ADMIN)
router.get(
  '/',
  requireRole(Role.VIEWER, Role.MEMBER, Role.ADMIN),
  validateRequest(listIncidentsSchema),
  IncidentController.listIncidents
);

// Create Incident (MEMBER, ADMIN)
router.post(
  '/',
  requireRole(Role.MEMBER, Role.ADMIN),
  validateRequest(createIncidentSchema),
  IncidentController.createIncident
);

// Get Incident Details (VIEWER, MEMBER, ADMIN)
router.get(
  '/:id',
  requireRole(Role.VIEWER, Role.MEMBER, Role.ADMIN),
  validateRequest(getIncidentSchema),
  IncidentController.getIncidentDetails
);

// Assign Incident (MEMBER, ADMIN)
router.patch(
  '/:id/assign',
  requireRole(Role.MEMBER, Role.ADMIN),
  validateRequest(assignIncidentSchema),
  IncidentController.assignIncident
);

// Update Status (MEMBER, ADMIN)
router.patch(
  '/:id/status',
  requireRole(Role.MEMBER, Role.ADMIN),
  validateRequest(changeStatusSchema),
  IncidentController.updateStatus
);

// Add Update (MEMBER, ADMIN)
router.post(
  '/:id/updates',
  requireRole(Role.MEMBER, Role.ADMIN),
  validateRequest(addUpdateSchema),
  IncidentController.addUpdate
);

export default router;
