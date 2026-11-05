import { Router } from 'express';
import * as statusController from '../controllers/status.controller.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import {
  publicOrgSchema,
  publicIncidentSchema,
  publicIncidentsListSchema,
} from '../validators/status.validators.js';

const router = Router();

// Public routes: requireAuth is deliberately absent. Anyone with the
// organization id can read what the controllers choose to expose.
router.get('/', validateRequest(publicOrgSchema), statusController.getOverview);
router.get('/services', validateRequest(publicOrgSchema), statusController.getServices);
router.get('/incidents', validateRequest(publicIncidentsListSchema), statusController.getIncidents);
router.get('/incidents/:id', validateRequest(publicIncidentSchema), statusController.getIncidentDetails);

export default router;
