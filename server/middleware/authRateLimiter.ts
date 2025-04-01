import { rateLimit } from 'express-rate-limit';
import { logger } from '../services/logger';
import { Request, Response, NextFunction } from 'express';

/**
 * Helper function to extract client IP safely with fallback
 * @param req Express request object
 * @returns Client IP address or 'unknown-ip' if none found
 */
function getClientIp(req: Request): string {
  const xForwardedFor = req.headers['x-forwarded-for'] as string | undefined;
  const ip = xForwardedFor ? xForwardedFor.split(',')[0].trim() : req.ip;
  return ip || 'unknown-ip';
}

/**
 * Helper function to determine if a request should be skipped for rate limiting
 * @param req Express request object
 * @param skipPaths Array of path prefixes to skip 
 * @returns Boolean indicating if rate limiting should be skipped
 */
function shouldSkipRateLimit(req: Request, skipPaths: string[] = []): boolean {
  // Skip for testing and health check endpoints
  if (req.path.includes('/health') || req.path.includes('/status')) {
    return true;
  }
  
  // Skip for API webhook endpoints that need to receive high volume of requests
  return skipPaths.some(path => req.path.startsWith(path));
}

/**
 * Rate limiter for authentication endpoints
 * Limits to 20 requests per 10 minutes per IP
 */
export const authRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20, // Limit each IP to 20 requests per window
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Configure to safely work with proxies
  trustProxy: false, // Disable automatic trust proxy (we handle it at the app level)
  // Use centralized IP extraction function
  keyGenerator: (req) => getClientIp(req),
  // Skip health check and status endpoints
  skip: (req) => shouldSkipRateLimit(req),
  message: {
    success: false,
    message: 'Too many authentication attempts. For security reasons, please wait 10 minutes before trying again.',
    retryAfter: '10 minutes',
    errorCode: 'RATE_LIMIT_AUTH'
  },
  handler: (req, res, next, options) => {
    logger.warn({
      message: `Rate limit exceeded for IP: ${getClientIp(req)} on path: ${req.path}`,
      category: 'security',
      source: 'internal',
      metadata: {
        ip: req.ip,
        forwardedIp: req.headers['x-forwarded-for'],
        path: req.path,
        userAgent: req.headers['user-agent']
      },
      tags: ['rate-limit', 'auth-endpoint']
    });
    
    // Send a more helpful response with retry information
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
  // Configure to safely work with proxies
  trustProxy: false, // Disable automatic trust proxy (we handle it at the app level)
  // Use centralized IP extraction function
  keyGenerator: (req) => getClientIp(req),
  // Skip health check and status endpoints
  skip: (req) => shouldSkipRateLimit(req),
  message: {
    success: false,
    message: 'For security reasons, account creation from this IP address has been temporarily limited. Please try again later or contact support.',
    retryAfter: '60 minutes',
    errorCode: 'RATE_LIMIT_REGISTRATION'
  },
  handler: (req, res, next, options) => {
    logger.warn({
      message: `User creation rate limit exceeded for IP: ${getClientIp(req)}`,
      category: 'security',
      source: 'internal',
      metadata: {
        ip: req.ip,
        forwardedIp: req.headers['x-forwarded-for'],
        path: req.path,
        userAgent: req.headers['user-agent']
      },
      tags: ['rate-limit', 'user-creation']
    });
    
    // Send a more helpful response with retry information
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
  // Configure to safely work with proxies
  trustProxy: false, // Disable automatic trust proxy (we handle it at the app level)
  // Use centralized IP extraction function
  keyGenerator: (req) => getClientIp(req),
  message: {
    success: false,
    message: 'Rate limit exceeded. Please wait before making additional requests.',
    retryAfter: '60 seconds',
    errorCode: 'RATE_LIMIT_API'
  },
  handler: (req, res, next, options) => {
    logger.warn({
      message: `API rate limit exceeded for IP: ${getClientIp(req)} on path: ${req.path}`,
      category: 'security',
      source: 'internal',
      metadata: {
        ip: req.ip,
        forwardedIp: req.headers['x-forwarded-for'],
        path: req.path,
        userAgent: req.headers['user-agent']
      },
      tags: ['rate-limit', 'api-endpoint']
    });
    
    // Send a more helpful response with retry information
    res.status(options.statusCode).send(options.message);
  },
  // Skip rate limiting for certain endpoints using our utility function
  skip: (req) => {
    const skipPaths = [
      '/api/plaid/webhook',
      '/api/stripe/webhook',
      '/api/twilio/webhook',
      '/api/health',
      '/api/status'
    ];
    
    return shouldSkipRateLimit(req, skipPaths);
  }
});