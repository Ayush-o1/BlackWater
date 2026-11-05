import { Router } from 'express';
import { authLimiter } from '../middleware/rateLimit.middleware.js';
import authRoutes from './auth.routes.js';
import incidentRoutes from './incident.routes.js';
import serviceRoutes from './service.routes.js';
import statusRoutes from './status.routes.js';
import userRoutes from './user.routes.js';
import organizationRoutes from './organization.routes.js';
import invitationRoutes from './invitation.routes.js';
import dashboardRoutes from './dashboard.routes.js';

// Everything under /api. Keeping the API in one router (mounted at /api in
// app.js) leaves the top-level URLs free for the web pages: /status/<id> is a
// page, /api/status is the data behind it.
const router = Router();

router.use('/auth', authLimiter, authRoutes);
router.use('/incidents', incidentRoutes);
router.use('/services', serviceRoutes);
router.use('/status', statusRoutes); // public: no login required
router.use('/users', userRoutes);
router.use('/organizations', organizationRoutes);
router.use('/invitations', invitationRoutes);
router.use('/dashboard', dashboardRoutes);

router.use((req, res) => {
  res.status(404).json({ success: false, message: `Cannot find ${req.originalUrl} on this server` });
});

export default router;
