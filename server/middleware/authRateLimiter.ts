import rateLimit from 'express-rate-limit';
import { logger } from '../services/logger';

// More strict rate limiting for authentication endpoints
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login attempts per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: { 
    success: false, 
    error: 'Too many login attempts from this IP, please try again after 15 minutes' 
  },
  handler: (req, res, _next, options) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    logger.warn({
      message: `Authentication rate limit exceeded for ${ip}`,
      category: 'security',
      source: 'internal',
      metadata: {
        ip,
        path: req.path,
        headers: req.headers,
        method: req.method
      }
    });
    res.status(429).json(options.message);
  },
  // Skip rate limiting in development mode
  skip: () => process.env.NODE_ENV === 'development'
});

// Rate limiter for user creation endpoints
export const userCreationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 user creations per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    success: false, 
    error: 'Too many accounts created from this IP, please try again after an hour' 
  },
  handler: (req, res, _next, options) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    logger.warn({
      message: `User creation rate limit exceeded for ${ip}`,
      category: 'security',
      source: 'internal',
      metadata: {
        ip,
        path: req.path
      }
    });
    res.status(429).json(options.message);
  },
  // Skip rate limiting in development mode
  skip: () => process.env.NODE_ENV === 'development'
});