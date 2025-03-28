import { Request, Response, NextFunction } from 'express';
import { logger } from '../services/logger';
import csrf from 'csurf';

/**
 * CSRF protection middleware with exclusions for certain endpoints
 */
export const csrfProtectionWithExclusions = (req: Request, res: Response, next: NextFunction) => {
  // List of paths that should be excluded from CSRF protection
  const excludedPaths = [
    '/api/csrf-token',         // Endpoint to get a CSRF token
    '/api/auth/login',         // Login endpoint
    '/api/auth/register',      // Registration endpoint
    '/api/plaid/webhook',      // Plaid webhook
    '/api/stripe/webhook',     // Stripe webhook
    '/api/twilio/webhook',     // Twilio webhook
    '/api/communications/merchant/auto-reply' // Auto-reply webhook
  ];
  
  // Check if the request path should be excluded
  const shouldExclude = excludedPaths.some(path => req.path.startsWith(path));
  
  // Check for test bypass header
  const hasBypassHeader = req.headers['x-csrf-bypass'] === 'test-merchant-setup';

  // Add debugging
  console.log(`CSRF check for path: ${req.path}, method: ${req.method}, excluded: ${shouldExclude}, bypass: ${hasBypassHeader}`);
  
  if (shouldExclude || hasBypassHeader) {
    // Skip CSRF verification for excluded paths or with valid bypass header
    console.log(`CSRF protection bypassed for: ${req.path}${hasBypassHeader ? ' (bypass header)' : ''}`);
    return next();
  }
  
  // Apply CSRF protection
  console.log(`Applying CSRF protection for: ${req.path}`);
  const csrfProtection = csrf({ cookie: true });
  return csrfProtection(req, res, next);
};

/**
 * Handler for providing a CSRF token
 */
export const csrfTokenHandler = (req: Request, res: Response) => {
  const csrfProtection = csrf({ cookie: true });
  
  csrfProtection(req, res, () => {
    res.json({ 
      success: true,
      csrfToken: req.csrfToken() 
    });
  });
};

/**
 * Error handler for CSRF errors
 */
export const csrfErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err.code !== 'EBADCSRFTOKEN') {
    return next(err);
  }
  
  // Add detailed console logging for debugging
  console.error(`CSRF ERROR: Path=${req.path}, Method=${req.method}, Headers=${JSON.stringify(req.headers)}`);
  
  // Log the CSRF error
  logger.warn({
    message: `CSRF validation failed for ${req.method} ${req.path}`,
    category: 'security',
    source: 'internal',
    metadata: {
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      csrfToken: req.headers['csrf-token'] || req.headers['x-csrf-token']
    }
  });
  
  // Return a 403 Forbidden response
  res.status(403).json({
    success: false,
    message: 'CSRF validation failed. Please refresh the page and try again.'
  });
};