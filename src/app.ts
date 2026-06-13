import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { globalErrorHandler } from './middleware/error.middleware';

const app: Application = express();

// Security middleware to set various HTTP headers
app.use(helmet());

// CORS middleware to allow cross-origin requests
app.use(cors());

// Parse JSON request body
app.use(express.json());

// Parse urlencoded request body
app.use(express.urlencoded({ extended: true }));

// Health check endpoint - used for load balancers and deployment verification
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'UP', message: 'BlackWater API is healthy' });
});

// Import routes
import authRoutes from './modules/auth/auth.routes';
import incidentRoutes from './modules/incidents/incident.routes';
import serviceRoutes from './modules/services/service.routes';
import statusRoutes from './modules/status/status.routes';
import userRoutes from './modules/users/user.routes';
import organizationRoutes from './modules/organizations/organization.routes';

// Mount routes
app.use('/auth', authRoutes);
app.use('/incidents', incidentRoutes);
app.use('/services', serviceRoutes);
app.use('/status', statusRoutes);
app.use('/users', userRoutes);
app.use('/organizations', organizationRoutes);

// Handle undefined routes
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    status: 'error',
    message: `Cannot find ${req.originalUrl} on this server`,
  });
});

// Global error handling middleware (must be registered last)
app.use(globalErrorHandler);

export default app;
