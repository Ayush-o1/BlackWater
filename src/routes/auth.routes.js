import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { validateRequest } from '../middleware/validate.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { authLimiter, loginLimiter } from '../middleware/rateLimit.middleware.js';
import { registerSchema, loginSchema } from '../validators/auth.validators.js';

const router = Router();

router.post('/register', authLimiter, validateRequest(registerSchema), authController.register);
router.post('/login', loginLimiter, validateRequest(loginSchema), authController.login);
router.get('/me', requireAuth, authController.getCurrentUser);

export default router;
