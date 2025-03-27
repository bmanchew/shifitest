import express, { Router, Express } from 'express';
import { createServer, Server } from 'http';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import plaidRoutes from './plaid.routes';
import notificationRoutes from './notification';
import { apiRateLimiter } from '../middleware/authRateLimiter';
import { logger } from '../services/logger';

// Create main router for modular routes
const modulesRouter = express.Router();

// Apply API rate limiting to all API routes
modulesRouter.use('/api', apiRateLimiter);

// Register all API routes with versioning
modulesRouter.use('/api/v1/auth', authRoutes);
modulesRouter.use('/api/v1/users', userRoutes);
modulesRouter.use('/api/v1/plaid', plaidRoutes);
modulesRouter.use('/api/v1/notifications', notificationRoutes);

// Support for legacy (non-versioned) routes during transition
modulesRouter.use('/api/auth', authRoutes);
modulesRouter.use('/api/users', userRoutes);
modulesRouter.use('/api/plaid', plaidRoutes);
modulesRouter.use('/api/notifications', notificationRoutes);

// Add a simple status endpoint for health checks
modulesRouter.get('/api/status', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is operational',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Track API usage
modulesRouter.use('/api', (req, res, next) => {
  // Record the request start time
  const start = Date.now();
  
  // Once response is finished, log the request details
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    logger.debug({
      message: `${req.method} ${req.path} ${res.statusCode} completed in ${duration}ms`,
      category: 'api',
      source: 'internal',
      metadata: {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip
      }
    });
  });
  
  next();
});

// Export router for standalone use
export default modulesRouter;

// Export function compatible with the original routes.ts for server startup
export async function registerRoutes(app: Express): Promise<Server> {
  // Apply our modular routes
  app.use(modulesRouter);
  
  // Create and return HTTP server
  return createServer(app);
}