import { Router } from 'express';
import { StatusController } from './status.controller';
import { validateRequest } from '../../middleware/validate.middleware';
import { publicOrgSchema, publicIncidentSchema, publicIncidentsListSchema } from './status.schemas';

const router = Router();

// Notice: We intentionally DO NOT use `requireAuth` here.

router.get(
  '/',
  validateRequest(publicOrgSchema),
  StatusController.getOverview
);

router.get(
  '/services',
  validateRequest(publicOrgSchema),
  StatusController.getServices
);

router.get(
  '/incidents',
  validateRequest(publicIncidentsListSchema),
  StatusController.getIncidents
);

router.get(
  '/incidents/:id',
  validateRequest(publicIncidentSchema),
  StatusController.getIncidentDetails
);

export default router;
