import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { globalErrorHandler } from './middleware/error.middleware.js';
import authRoutes from './routes/auth.routes.js';
import incidentRoutes from './routes/incident.routes.js';
import serviceRoutes from './routes/service.routes.js';
import statusRoutes from './routes/status.routes.js';
import userRoutes from './routes/user.routes.js';
import organizationRoutes from './routes/organization.routes.js';

const app = express();

app.use(helmet());

// Only the configured frontend origin(s) may call the API from a browser.
app.use(cors({ origin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()), credentials: true }));

const tooManyRequests = { status: 'error', message: 'Too many requests, please try again later' };

// Strict limit on login and registration to slow down password guessing.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooManyRequests,
});

// Looser baseline for everything else.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooManyRequests,
});

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

app.use('*', (req, res) => {
  res.status(404).json({ status: 'error', message: `Cannot find ${req.originalUrl} on this server` });
});

// Must be registered last so it receives errors from everything above.
app.use(globalErrorHandler);

export default app;
