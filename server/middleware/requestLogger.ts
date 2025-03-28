import { Request, Response, NextFunction } from "express";
import { logger } from "../services/logger";

/**
 * Advanced request logger middleware
 * Logs detailed information about all incoming requests
 */
export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction) {
  // Get the start time to calculate request duration
  const startTime = Date.now();
  
  // Create a unique request ID to track this request through logs
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  
  // Log the incoming request
  logger.info({
    message: `✨ REQUEST: ${req.method} ${req.originalUrl}`,
    category: "http",
    source: "request-logger",
    metadata: {
      requestId,
      method: req.method,
      path: req.originalUrl,
      query: req.query,
      headers: {
        host: req.headers.host,
        referer: req.headers.referer,
        'user-agent': req.headers['user-agent'],
        authorization: req.headers.authorization ? '[REDACTED]' : undefined,
        'content-type': req.headers['content-type'],
        'content-length': req.headers['content-length'],
        cookie: req.headers.cookie ? '[REDACTED]' : undefined,
      },
      ip: req.ip,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? 
        (req.body && Object.keys(req.body).length ? 
          (req.originalUrl.includes('login') || req.originalUrl.includes('password') ?
            { ...req.body, password: '[REDACTED]' } : 
            req.body) : 
          '[EMPTY]') : 
        undefined,
      timestamp: new Date().toISOString()
    }
  });
  
  // Create response interceptor to log response data
  const originalSend = res.send;
  res.send = function(body) {
    const responseTime = Date.now() - startTime;
    
    // Attach the response body to the response object
    // to access it in our response logging
    res.locals.responseBody = body;
    
    // Log the response
    logger.info({
      message: `✨ RESPONSE: ${req.method} ${req.originalUrl} - ${res.statusCode} (${responseTime}ms)`,
      category: "http",
      source: "request-logger",
      metadata: {
        requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
        responseHeaders: {
          'content-type': res.getHeader('content-type'),
          'content-length': res.getHeader('content-length'),
        },
        // Don't log response body for successful GET requests to reduce log volume
        responseBody: res.statusCode >= 400 || req.method !== 'GET' ? 
          (typeof body === 'string' && body.length > 500 ? 
            `${body.substring(0, 500)}... [truncated]` : 
            body) : 
          '[NOT LOGGED]',
        timestamp: new Date().toISOString()
      }
    });
    
    // Call the original send function and return its result
    return originalSend.call(this, body);
  };
  
  // Continue with the request
  next();
}

/**
 * Error logger middleware
 * Logs detailed information about errors that occur during request processing
 */
export function errorLoggerMiddleware(err: Error, req: Request, res: Response, next: NextFunction) {
  logger.error({
    message: `❌ ERROR: ${req.method} ${req.originalUrl} - ${err.message}`,
    category: "http",
    source: "error-logger",
    metadata: {
      method: req.method,
      path: req.originalUrl,
      query: req.query,
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack
      },
      timestamp: new Date().toISOString()
    }
  });
  
  // Pass to the next error handler
  next(err);
}