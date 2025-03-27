/**
 * CSRF Protection Middleware
 * 
 * This middleware sets up CSRF protection for the application using csurf package.
 * It includes the following features:
 * 1. CSRF token generation endpoint
 * 2. CSRF validation middleware for protected routes
 * 3. Exclusion list for routes that don't need CSRF protection
 */

import { Request, Response, NextFunction } from 'express';
import csurf from 'csurf';

// Define the list of routes that should be exempt from CSRF protection
// These are typically webhook endpoints and authentication endpoints
const csrfExcludedRoutes = [
  '/api/plaid/webhook',
  '/api/didit/webhook',
  '/api/thanksroger/webhook',
  '/api/twilio/webhook',
  '/api/csrf-token', // The token endpoint itself is excluded
];

// Create CSRF protection middleware with cookie-based tokens
export const csrfProtection = csurf({
  cookie: {
    key: '_csrf',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Only use secure cookies in production
    sameSite: 'lax', // Provides some CSRF protection by browsers
  }
});

// Middleware to exclude specified routes from CSRF protection
export function csrfProtectionWithExclusions(req: Request, res: Response, next: NextFunction) {
  // Check if the current path is in the excluded list
  const isExcluded = csrfExcludedRoutes.some(route => req.path.includes(route));
  
  // Skip CSRF protection for excluded routes
  if (isExcluded) {
    return next();
  }
  
  // Apply CSRF protection for all other routes
  return csrfProtection(req, res, next);
}

// Route handler for the CSRF token endpoint
export function csrfTokenHandler(req: Request, res: Response) {
  // Send the CSRF token to the client
  res.json({
    success: true,
    csrfToken: req.csrfToken()
  });
}

// Error handler for CSRF validation errors
export function csrfErrorHandler(err: Error & { code?: string }, req: Request, res: Response, next: NextFunction) {
  if (err.code !== 'EBADCSRFTOKEN') {
    return next(err);
  }
  
  // Handle CSRF token validation failures
  console.error(`CSRF token validation failed for ${req.method} ${req.path}`);
  
  // Return a 403 Forbidden response
  res.status(403).json({
    success: false,
    error: 'CSRF token validation failed. Please refresh the page and try again.'
  });
}