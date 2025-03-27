import express, { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import plaidRoutes from './plaid.routes';
import { apiRateLimiter } from '../middleware/authRateLimiter';
import { logger } from '../services/logger';

// Create main router
const router = express.Router();

// Apply API rate limiting to all API routes
router.use('/api', apiRateLimiter);

// Register all API routes with versioning
router.use('/api/v1/auth', authRoutes);
router.use('/api/v1/users', userRoutes);
router.use('/api/v1/plaid', plaidRoutes);

// Support for legacy (non-versioned) routes during transition
router.use('/api/auth', authRoutes);
router.use('/api/users', userRoutes);
router.use('/api/plaid', plaidRoutes);

// Add a simple status endpoint for health checks
router.get('/api/status', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is operational',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Track API usage
router.use('/api', (req, res, next) => {
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

export default router;