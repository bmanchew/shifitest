import { Request, Response, NextFunction } from 'express';
import { logger } from '../services/logger';

/**
 * Debug middleware specifically for login-related routes
 * This middleware logs detailed information about requests to help diagnose issues
 */
export function debugLoginRoutes(req: Request, res: Response, next: NextFunction) {
  // Only apply to login-related routes
  if (req.originalUrl.includes('/auth/login')) {
    // Create a unique request ID for tracking
    const requestId = `login-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    // Log the incoming request with detailed information
    logger.info({
      message: `🔍 DEBUG LOGIN REQUEST: ${req.method} ${req.originalUrl}`,
      category: 'debug',
      source: 'login-debug',
      metadata: {
        requestId,
        method: req.method,
        url: req.originalUrl,
        path: req.path,
        baseUrl: req.baseUrl,
        headers: {
          host: req.headers.host,
          'user-agent': req.headers['user-agent'],
          'content-type': req.headers['content-type'],
          cookie: req.headers.cookie ? '[PRESENT]' : '[NONE]',
          origin: req.headers.origin,
          referer: req.headers.referer
        },
        ip: req.ip,
        query: req.query,
        params: req.params,
        body: req.method === 'POST' ? 
          { ...req.body, password: req.body.password ? '[REDACTED]' : undefined } : 
          undefined,
        timestamp: new Date().toISOString()
      }
    });
    
    // Capture the original send method
    const originalSend = res.send;
    
    // Override send to log the response
    res.send = function(body) {
      logger.info({
        message: `🔍 DEBUG LOGIN RESPONSE: ${req.method} ${req.originalUrl} - ${res.statusCode}`,
        category: 'debug',
        source: 'login-debug',
        metadata: {
          requestId,
          statusCode: res.statusCode,
          headers: {
            'content-type': res.getHeader('content-type'),
            'set-cookie': res.getHeader('set-cookie') ? '[PRESENT]' : '[NONE]'
          },
          body: typeof body === 'string' ? 
            (body.includes('password') ? '[REDACTED SENSITIVE DATA]' : body) : 
            body,
          timestamp: new Date().toISOString()
        }
      });
      
      // Call the original send
      return originalSend.call(this, body);
    };
  }
  
  // Continue with request processing
  next();
}

/**
 * Advanced route path debugging middleware
 * This middleware helps diagnose routing issues by logging detailed route path information
 */
export function debugRoutePaths(prefix: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    logger.info({
      message: `🧭 ROUTE DEBUG: ${req.method} ${req.originalUrl}`,
      category: 'debug',
      source: 'route-debug',
      metadata: {
        prefix,
        method: req.method,
        originalUrl: req.originalUrl,
        baseUrl: req.baseUrl,
        path: req.path,
        route: req.route ? 'Matched' : 'Not matched',
        params: req.params,
        timestamp: new Date().toISOString()
      }
    });
    
    next();
  };
}