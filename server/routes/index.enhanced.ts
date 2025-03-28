import express, { Router, Express, Request, Response, NextFunction } from 'express';
import { createServer, Server } from 'http';
import authRouter from './auth';
import userRouter from './users';
import plaidRoutes from './plaid.routes';
import notificationRoutes from './notification';
import communicationsRoutes from './communications';
import merchantFundingRoutes from './merchant-funding';
import customerRoutes from './customers';
import adminRouter from './admin';
import { reportsRouter } from './admin/reports';
import { adminReportsRouter } from './adminReports';
import contractsRouter from './contracts';
import underwritingRouter from './underwriting';
import merchantRouter from './merchant';
import merchantDashboardRouter from './merchant-dashboard';
import notificationRouter from './notification';
import paymentRouter from './payments';
import healthRouter from './health';
import blockchainRouter from './blockchain';
import salesRepRouter from './salesRep';
import { apiRateLimiter } from '../middleware/authRateLimiter';
import { logger } from '../services/logger';
import { requestLoggerMiddleware, errorLoggerMiddleware } from '../middleware/requestLogger';

// Create main router for modular routes
const modulesRouter = express.Router();

// Add advanced request logging for API routes
modulesRouter.use(requestLoggerMiddleware);

// Apply API rate limiting to all API routes
modulesRouter.use('/api', apiRateLimiter);

// Register API routes in the /api namespace
const apiRouter = express.Router();

// Add simple health check for the API
apiRouter.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'ShiFi API is operational',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Register auth routes - critical for login functionality
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', userRouter);

// Legacy support for versioned API routes if needed
const v1Router = express.Router();
v1Router.use('/auth', authRouter);
v1Router.use('/users', userRouter);
v1Router.use('/plaid', plaidRoutes);
v1Router.use('/notifications', notificationRoutes);
v1Router.use('/communications', communicationsRoutes);
v1Router.use('/merchant-funding', merchantFundingRoutes);
v1Router.use('/customers', customerRoutes);
apiRouter.use('/v1', v1Router);

// Feature-specific domain routers
apiRouter.use('/admin/reports', reportsRouter);
apiRouter.use('/admin/analysis', adminReportsRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/underwriting', underwritingRouter);
apiRouter.use('/contracts', contractsRouter);
apiRouter.use('/customers', customerRoutes);
apiRouter.use('/merchants', merchantRouter);
apiRouter.use('/merchant-dashboard', merchantDashboardRouter);
apiRouter.use('/merchant-funding', merchantFundingRoutes);
apiRouter.use('/notifications', notificationRouter);
apiRouter.use('/payments', paymentRouter);
apiRouter.use('/health', healthRouter);
apiRouter.use('/blockchain', blockchainRouter);
apiRouter.use('/sales-reps', salesRepRouter);

// Communication routes with aliases for different interfaces
apiRouter.use('/communications', communicationsRoutes);
apiRouter.use('/conversations', communicationsRoutes);
apiRouter.use('/support-tickets', communicationsRoutes);

// 404 handler for API routes - log detailed information
apiRouter.use((req: Request, res: Response) => {
  // Log the 404 with detailed path information
  logger.warn({
    message: `API 404: Endpoint not found - ${req.method} ${req.originalUrl}`,
    category: 'api',
    source: 'internal',
    metadata: {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      params: req.params,
      query: req.query
    }
  });
  
  // Track request completion with status code
  logger.warn({
    message: `${req.method} ${req.path} 404 - Completed in ${Date.now() - (req.locals?.startTime || Date.now())}ms`,
    category: 'api',
    source: 'internal',
    metadata: {
      method: req.method,
      path: req.path,
      statusCode: 404,
      duration: `${Date.now() - (req.locals?.startTime || Date.now())}ms`,
      ip: req.ip
    }
  });
  
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Mount API router within the modules router
modulesRouter.use('/api', apiRouter);

// Error handler for all API routes
modulesRouter.use(errorLoggerMiddleware);

// Export router for standalone use
export default modulesRouter;

// Export function compatible with the original routes.ts for server startup
export async function registerRoutes(app: Express): Promise<Server> {
  // Apply our modular routes
  app.use(modulesRouter);
  
  // Create and return HTTP server
  return createServer(app);
}