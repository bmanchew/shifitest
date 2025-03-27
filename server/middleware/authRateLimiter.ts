import { rateLimit } from 'express-rate-limit';
import { logger } from '../services/logger';

/**
 * Rate limiter for authentication endpoints
 * Limits to 20 requests per 10 minutes per IP
 */
export const authRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20, // Limit each IP to 20 requests per window
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  },
  handler: (req, res, next, options) => {
    logger.warn({
      message: `Rate limit exceeded for IP: ${req.ip} on path: ${req.path}`,
      category: 'security',
      source: 'internal',
      metadata: {
        ip: req.ip,
        path: req.path,
        userAgent: req.headers['user-agent']
      }
    });
    
    res.status(options.statusCode).send(options.message);
  }
});

/**
 * Rate limiter for user creation endpoints (registration)
 * Limits to 5 requests per 60 minutes per IP
 */
export const userCreationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 60 minutes
  max: 5, // Limit each IP to 5 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many accounts created from this IP, please try again after an hour.'
  },
  handler: (req, res, next, options) => {
    logger.warn({
      message: `User creation rate limit exceeded for IP: ${req.ip}`,
      category: 'security',
      source: 'internal',
      metadata: {
        ip: req.ip,
        path: req.path,
        userAgent: req.headers['user-agent']
      }
    });
    
    res.status(options.statusCode).send(options.message);
  }
});

/**
 * Rate limiter for API endpoints
 * Limits to 100 requests per minute per IP
 */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  },
  handler: (req, res, next, options) => {
    logger.warn({
      message: `API rate limit exceeded for IP: ${req.ip} on path: ${req.path}`,
      category: 'security',
      source: 'internal',
      metadata: {
        ip: req.ip,
        path: req.path,
        userAgent: req.headers['user-agent']
      }
    });
    
    res.status(options.statusCode).send(options.message);
  },
  // Skip rate limiting for certain endpoints like webhook receivers
  skip: (req) => {
    const skipPaths = [
      '/api/plaid/webhook',
      '/api/stripe/webhook',
      '/api/twilio/webhook'
    ];
    
    return skipPaths.some(path => req.path.startsWith(path));
  }
});