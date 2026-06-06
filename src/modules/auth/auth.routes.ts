import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validateRequest } from '../../middleware/validate.middleware';
import { registerSchema, loginSchema } from './auth.schemas';
import { requireAuth } from '../../middleware/auth.middleware';

const router = Router();

// Public Routes
router.post('/register', validateRequest(registerSchema), AuthController.register);
router.post('/login', validateRequest(loginSchema), AuthController.login);

// Protected Routes
router.get('/me', requireAuth, AuthController.getCurrentUser);

export default router;
