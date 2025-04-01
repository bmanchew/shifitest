/**
 * Enhanced Security Middleware
 * 
 * This file contains security middleware for the investor portal, including:
 * - Rate limiting to prevent brute force attacks
 * - Input validation and sanitization
 * - Enhanced logging for security events
 * - Investor-specific security features
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { logger } from '../services/logger';

// Basic rate limiter for general API endpoints
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn({
      message: 'Rate limit exceeded',
      category: 'security',
      action: 'rate_limit_exceeded',
      metadata: {
        ip: req.ip,
        path: req.path,
        method: req.method
      }
    });
    
    res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later.'
    });
  }
});

// Stricter rate limiter for authentication endpoints
export const authRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 auth requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn({
      message: 'Authentication rate limit exceeded',
      category: 'security',
      action: 'auth_rate_limit_exceeded',
      metadata: {
        ip: req.ip,
        path: req.path,
        method: req.method
      }
    });
    
    res.status(429).json({
      success: false,
      message: 'Too many authentication attempts, please try again later.'
    });
  }
});

// Input validation middleware factory
export function validateInput<T>(schema: z.ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request body against schema
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        
        logger.warn({
          message: 'Input validation failed',
          category: 'security',
          action: 'validation_failed',
          metadata: {
            path: req.path,
            errors: validationError.details,
            ip: req.ip
          }
        });
        
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: validationError.details
        });
      }
      
      next(error);
    }
  };
}

// Security logging middleware
export function securityLogger(req: Request, res: Response, next: NextFunction) {
  // Log sensitive operations
  const sensitiveOperations = ['/api/investor/investments', '/api/investor/plaid', '/api/auth'];
  
  if (
    sensitiveOperations.some(op => req.path.includes(op)) ||
    req.method !== 'GET'
  ) {
    logger.info({
      message: `Security event: ${req.method} ${req.path}`,
      category: 'security',
      action: 'sensitive_operation',
      metadata: {
        path: req.path,
        method: req.method,
        ip: req.ip,
        userId: req.user?.id
      }
    });
  }
  
  next();
}

// Middleware to prevent clickjacking
export function preventClickjacking(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Frame-Options', 'DENY');
  next();
}

// Middleware to set Content Security Policy
export function setCSP(req: Request, res: Response, next: NextFunction) {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' https://js.stripe.com https://cdn.plaid.com; frame-src https://js.stripe.com https://cdn.plaid.com; connect-src 'self' https://api.stripe.com https://*.plaid.com wss://*.openai.com https://*.openai.com wss://*.replit.dev wss://*.janeway.replit.dev https://*.replit.dev https://*.janeway.replit.dev; img-src 'self' data:; style-src 'self' 'unsafe-inline';"
  );
  next();
}

// Middleware to protect investor document access
export function protectDocumentAccess(req: Request, res: Response, next: NextFunction) {
  // If attempting to access a document
  if (req.path.includes('/api/investor/documents/') && req.path.split('/').length > 4) {
    const documentId = parseInt(req.path.split('/')[4]);
    
    if (isNaN(documentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document ID'
      });
    }
    
    // Additional checks can be added here based on document permissions
    logger.info({
      message: `Document access attempt: ${documentId}`,
      category: 'security',
      action: 'document_access',
      metadata: {
        documentId,
        userId: req.user?.id,
        ip: req.ip
      }
    });
  }
  
  next();
}

// Middleware to validate investment amounts and prevent excessive purchases
export function validateInvestmentLimits(req: Request, res: Response, next: NextFunction) {
  if (req.path === '/api/investor/investments' && req.method === 'POST') {
    const amount = req.body.amount;
    
    // Ensure amount is a number and within reasonable bounds
    if (typeof amount !== 'number' || amount < 10000 || amount > 10000000) {
      return res.status(400).json({
        success: false,
        message: 'Investment amount must be between $10,000 and $10,000,000'
      });
    }
    
    // Log high-value investments for security monitoring
    if (amount > 100000) {
      logger.info({
        message: `High-value investment attempt: $${amount}`,
        category: 'security',
        action: 'high_value_investment',
        metadata: {
          amount,
          userId: req.user?.id,
          ip: req.ip
        }
      });
    }
  }
  
  next();
}

// Middleware to audit all database modifications
export function auditDatabaseChanges(req: Request, res: Response, next: NextFunction) {
  // Only audit POST, PUT, PATCH, DELETE operations
  if (req.method === 'GET') {
    return next();
  }
  
  // Create a copy of the original response methods
  const originalSend = res.send;
  const originalJson = res.json;
  const originalEnd = res.end;
  
  // Override the response methods to log successful operations
  res.send = function(body: any) {
    logAuditEvent(req, res, body);
    return originalSend.apply(res, [body]);
  };
  
  res.json = function(body: any) {
    logAuditEvent(req, res, body);
    return originalJson.apply(res, [body]);
  };
  
  res.end = function(chunk: any) {
    if (chunk) {
      logAuditEvent(req, res, chunk);
    }
    return originalEnd.apply(res, [chunk]);
  };
  
  next();
}

// Helper function to log audit events
function logAuditEvent(req: Request, res: Response, body: any) {
  // Only log successful operations
  if (res.statusCode >= 200 && res.statusCode < 300) {
    let parsedBody;
    
    try {
      parsedBody = typeof body === 'string' ? JSON.parse(body) : body;
    } catch (e) {
      parsedBody = { message: 'Could not parse response body' };
    }
    
    // Don't log sensitive data
    const sanitizedBody = { ...parsedBody };
    ['password', 'token', 'accessToken', 'secret', 'plaidAccessToken'].forEach(key => {
      if (sanitizedBody[key]) {
        sanitizedBody[key] = '[REDACTED]';
      }
    });
    
    logger.info({
      message: `Database operation: ${req.method} ${req.path}`,
      category: 'audit',
      action: 'database_change',
      metadata: {
        path: req.path,
        method: req.method,
        statusCode: res.statusCode,
        userId: req.user?.id,
        ip: req.ip,
        response: sanitizedBody
      }
    });
  }
}

// Export combined security middleware
export const securityMiddleware = [
  preventClickjacking,
  setCSP,
  securityLogger,
  protectDocumentAccess,
  validateInvestmentLimits,
  auditDatabaseChanges
];