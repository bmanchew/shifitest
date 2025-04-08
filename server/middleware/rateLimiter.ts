import rateLimit from 'express-rate-limit';
import { ErrorFactory } from '../services/errorHandler';

/**
 * Standard API rate limiter - 100 requests per 15 minutes
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res, next) => {
    next(ErrorFactory.custom({
      message: 'Too many requests, please try again later.',
      statusCode: 429,
      errorCode: 'RATE_LIMIT_EXCEEDED',
      category: 'security'
    }));
  }
});

/**
 * Stricter rate limiter for authentication endpoints - 10 requests per 15 minutes
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(ErrorFactory.custom({
      message: 'Too many authentication attempts, please try again later.',
      statusCode: 429,
      errorCode: 'AUTH_RATE_LIMIT_EXCEEDED',
      category: 'security'
    }));
  }
});