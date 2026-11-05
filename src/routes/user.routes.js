import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { updateProfileSchema, listUsersSchema } from '../validators/user.validators.js';

const router = Router();

router.use(requireAuth);

router.get('/', validateRequest(listUsersSchema), userController.listUsers);
router.get('/me', userController.getMe);
router.patch('/me', validateRequest(updateProfileSchema), userController.updateProfile);

export default router;
