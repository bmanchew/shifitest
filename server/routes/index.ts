import express, { Router, Express } from 'express';
import { createServer, Server } from 'http';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import plaidRoutes from './plaid.routes';
import notificationRoutes from './notification';
import communicationsRoutes from './communications';
import merchantFundingRoutes from './merchant-funding';
import customerRoutes from './customers';
import merchantRoutes from './merchant';
import merchantContractsRoutes from './merchant/contracts';
import exampleRoutes from './example.routes';
import investorRoutes from './investor';
import adminRoutes from './admin/index';
import contractsRoutes from './contracts.routes';
import supportTicketsRoutes from './support-tickets';
import currentMerchantRoutes from './current-merchant';
import applicationProgressRouter from './application-progress';
import documentsRouter from './documents';
import analyticsRoutes from './analytics';
import { ticketAssignmentRouter } from './ticket-assignment';
import ticketCategorizationRouter from './ticket-categorization';
import { apiRateLimiter } from '../middleware/authRateLimiter';
import { logger } from '../services/logger';
import { authenticateToken } from '../middleware/auth';

// Create main router for modular routes
const modulesRouter = express.Router();

// Apply API rate limiting to all API routes
modulesRouter.use('/api', apiRateLimiter);

// Register all API routes with versioning
modulesRouter.use('/api/v1/auth', authRoutes);
modulesRouter.use('/api/v1/users', userRoutes);
modulesRouter.use('/api/v1/plaid', plaidRoutes);
modulesRouter.use('/api/v1/notifications', notificationRoutes);
modulesRouter.use('/api/v1/communications', communicationsRoutes);
modulesRouter.use('/api/v1/merchant-funding', merchantFundingRoutes);
modulesRouter.use('/api/v1/customers', customerRoutes);
modulesRouter.use('/api/v1/examples', exampleRoutes);
modulesRouter.use('/api/v1/investor', investorRoutes);
modulesRouter.use('/api/v1/merchants', merchantRoutes);
modulesRouter.use('/api/v1/admin', adminRoutes);
modulesRouter.use('/api/v1/contracts', contractsRoutes);
modulesRouter.use('/api/v1/support-tickets', supportTicketsRoutes);
modulesRouter.use('/api/v1/current-merchant', currentMerchantRoutes);
modulesRouter.use('/api/v1/application-progress', applicationProgressRouter);
modulesRouter.use('/api/v1/documents', documentsRouter);
modulesRouter.use('/api/v1/analytics', analyticsRoutes);
modulesRouter.use('/api/v1/ticket-assignment', ticketAssignmentRouter);
modulesRouter.use('/api/v1', ticketCategorizationRouter);
modulesRouter.use('/api/v1/merchant', authenticateToken, (req, res, next) => {
  next();
}, (req, res, next) => {
  if (req.path === '/contracts') {
    return merchantContractsRoutes(req, res, next);
  }
  next();
});

// Support for legacy (non-versioned) routes during transition
modulesRouter.use('/api/auth', authRoutes);
modulesRouter.use('/api/users', userRoutes);
modulesRouter.use('/api/plaid', plaidRoutes);
modulesRouter.use('/api/notifications', notificationRoutes);
modulesRouter.use('/api/communications', communicationsRoutes);
modulesRouter.use('/api/merchant-funding', merchantFundingRoutes);
modulesRouter.use('/api/customers', customerRoutes);
modulesRouter.use('/api/examples', exampleRoutes);
modulesRouter.use('/api/investor', investorRoutes);
modulesRouter.use('/api/merchants', merchantRoutes);
modulesRouter.use('/api/admin', adminRoutes);
modulesRouter.use('/api/contracts', contractsRoutes);
modulesRouter.use('/api/support-tickets', supportTicketsRoutes);
modulesRouter.use('/api/current-merchant', currentMerchantRoutes);
modulesRouter.use('/api/application-progress', applicationProgressRouter);
modulesRouter.use('/api/documents', documentsRouter);
modulesRouter.use('/api/analytics', analyticsRoutes);
modulesRouter.use('/api/ticket-assignment', ticketAssignmentRouter);
modulesRouter.use('/', ticketCategorizationRouter);
modulesRouter.use('/api/merchant', authenticateToken, (req, res, next) => {
  next();
}, (req, res, next) => {
  if (req.path === '/contracts') {
    return merchantContractsRoutes(req, res, next);
  }
  next();
});

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