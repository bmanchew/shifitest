import { rateLimit } from 'express-rate-limit';
import { logger } from '../services/logger';

// General API rate limiter (applies to all API endpoints)
export const apiRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 300, // Limit each IP to 300 requests per 10-minute window
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: 'Too many requests from this IP address, please try again later.',
  skipSuccessfulRequests: false, // Count all requests
  handler: (req, res, _next, options) => {
    logger.warn({
      message: `Rate limit exceeded for IP ${req.ip} on path ${req.path}`,
      category: 'security',
      source: 'internal',
      metadata: {
        ip: req.ip,
        path: req.path,
        method: req.method,
        headers: req.headers
      }
    });
    
    res.status(options.statusCode).json({
      success: false,
      message: options.message
    });
  }
});

// Stricter limiter for authentication endpoints
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 authentication attempts per 15-minute window
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts from this IP address, please try again after 15 minutes.',
  handler: (req, res, _next, options) => {
    logger.warn({
      message: `Authentication rate limit exceeded for IP ${req.ip}`,
      category: 'security',
      source: 'internal',
      metadata: {
        ip: req.ip,
        path: req.path,
        method: req.method,
        headers: req.headers
      }
    });
    
    res.status(options.statusCode).json({
      success: false,
      message: options.message
    });
  }
});

// Very strict limiter for user creation to prevent abuse
export const userCreationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 user creation attempts per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many account creation attempts from this IP address, please try again after 1 hour.',
  handler: (req, res, _next, options) => {
    logger.warn({
      message: `User creation rate limit exceeded for IP ${req.ip}`,
      category: 'security',
      source: 'internal',
      metadata: {
        ip: req.ip,
        path: req.path,
        method: req.method,
        headers: req.headers
      }
    });
    
    res.status(options.statusCode).json({
      success: false,
      message: options.message
    });
  }
});