import { Router } from 'express';
import { UserController } from './user.controller';
import { validateRequest } from '../../middleware/validate.middleware';
import { updateProfileSchema, listUsersSchema } from './user.schemas';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router();

// All user routes require authentication
router.use(requireAuth);

router.get('/', validateRequest(listUsersSchema), UserController.listUsers);
router.get('/me', UserController.getMe);
router.patch('/me', validateRequest(updateProfileSchema), UserController.updateProfile);

export default router;
