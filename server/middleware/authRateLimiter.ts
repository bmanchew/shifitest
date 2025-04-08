/**
 * Auth Rate Limiter Middleware
 * 
 * This middleware provides rate limiting for authentication routes to prevent brute force
 * attacks and abuse. It uses in-memory storage with IP-based tracking and supports different
 * rate limits for different routes.
 */
import { Request, Response, NextFunction } from 'express';
import { logger } from '../services/logger';

// In-memory storage for rate limiting
interface RateLimitRecord {
  count: number;
  resetTime: number;
}

// Store rate limit data by IP
const rateLimits: Record<string, RateLimitRecord> = {};

// Clean up expired rate limit records periodically (every 15 minutes)
setInterval(() => {
  const now = Date.now();
  for (const ip in rateLimits) {
    if (rateLimits[ip].resetTime <= now) {
      delete rateLimits[ip];
    }
  }
}, 15 * 60 * 1000);

/**
 * Creates a rate limiter middleware with configurable options
 * 
 * @param maxRequests Maximum number of requests allowed in the window
 * @param windowMs Time window in milliseconds for rate limiting
 * @param message Custom error message to return when rate limit is exceeded
 * @returns Express middleware function
 */
export function createRateLimiter(
  maxRequests: number = 5,
  windowMs: number = 60 * 1000, // 1 minute by default
  message: string = 'Too many requests from this IP, please try again later.'
) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get client IP
      const ip = (req.headers['x-forwarded-for'] as string) || 
                 req.socket.remoteAddress || 
                 'unknown';
      
      const now = Date.now();
      
      // Initialize or update rate limit record
      if (!rateLimits[ip] || rateLimits[ip].resetTime <= now) {
        // Reset or create new record
        rateLimits[ip] = {
          count: 1,
          resetTime: now + windowMs
        };
      } else {
        // Increment existing record
        rateLimits[ip].count++;
      }
      
      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxRequests - rateLimits[ip].count)));
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(rateLimits[ip].resetTime / 1000)));
      
      // Check if rate limit is exceeded
      if (rateLimits[ip].count > maxRequests) {
        logger.warn({
          message: `Rate limit exceeded for IP ${ip}`,
          category: 'security',
          source: 'internal',
          metadata: {
            ip,
            path: req.path,
            method: req.method,
            userAgent: req.headers['user-agent'],
            currentCount: rateLimits[ip].count,
            limit: maxRequests
          }
        });
        
        return res.status(429).json({
          success: false,
          message,
          retryAfter: Math.ceil((rateLimits[ip].resetTime - now) / 1000)
        });
      }
      
      next();
    } catch (error) {
      // If rate limiting fails, log and continue to prevent blocking legitimate traffic
      logger.error({
        message: `Rate limiter error: ${error instanceof Error ? error.message : String(error)}`,
        category: 'security',
        source: 'internal',
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          path: req.path,
          method: req.method
        }
      });
      next();
    }
  };
}

// Standard rate limiter for login attempts (5 requests per minute)
export const loginRateLimiter = createRateLimiter(
  5,
  60 * 1000,
  'Too many login attempts. Please try again later.'
);

// More restrictive rate limiter for password reset (3 requests per 5 minutes)
export const passwordResetRateLimiter = createRateLimiter(
  3,
  5 * 60 * 1000,
  'Too many password reset attempts. Please try again in 5 minutes.'
);

// Slightly more permissive rate limiter for registration (10 requests per hour)
export const registrationRateLimiter = createRateLimiter(
  10,
  60 * 60 * 1000,
  'Too many registration attempts. Please try again later.'
);

// Very restrictive rate limiter for failed verification attempts (3 requests per 15 minutes)
export const verificationRateLimiter = createRateLimiter(
  3,
  15 * 60 * 1000,
  'Too many verification attempts. Please try again later.'
);

// General API rate limiter (100 requests per minute)
export const apiRateLimiter = createRateLimiter(
  100,
  60 * 1000, 
  'API rate limit exceeded. Please try again later.'
);

// Auth-specific rate limiter (wrapper around login rate limiter)
export const authRateLimiter = loginRateLimiter;

// User creation rate limiter (same as registration)
export const userCreationRateLimiter = registrationRateLimiter;