import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { globalErrorHandler } from './middleware/error.middleware.js';
import { apiLimiter, authLimiter } from './middleware/rateLimit.middleware.js';
import authRoutes from './routes/auth.routes.js';
import incidentRoutes from './routes/incident.routes.js';
import serviceRoutes from './routes/service.routes.js';
import statusRoutes from './routes/status.routes.js';
import userRoutes from './routes/user.routes.js';
import organizationRoutes from './routes/organization.routes.js';
import invitationRoutes from './routes/invitation.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';

const app = express();

// Behind a reverse proxy every request appears to come from the proxy. Telling
// Express how many proxies to trust makes req.ip (and the rate limits) use the
// visitor's real address from X-Forwarded-For.
if (env.TRUST_PROXY > 0) {
  app.set('trust proxy', env.TRUST_PROXY);
}

app.use(helmet());

// Only the configured frontend origin(s) may call the API from a browser.
app.use(cors({ origin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()), credentials: true }));

app.use(apiLimiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP', message: 'BlackWater API is healthy' });
});

app.use('/auth', authLimiter, authRoutes);
app.use('/incidents', incidentRoutes);
app.use('/services', serviceRoutes);
app.use('/status', statusRoutes);
app.use('/users', userRoutes);
app.use('/organizations', organizationRoutes);
app.use('/invitations', invitationRoutes);
app.use('/dashboard', dashboardRoutes);

app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: `Cannot find ${req.originalUrl} on this server` });
});

// Must be registered last so it receives errors from everything above.
app.use(globalErrorHandler);

export default app;
