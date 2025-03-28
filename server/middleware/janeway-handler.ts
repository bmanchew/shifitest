import { Request, Response, NextFunction } from 'express';
import path from 'path';
import { logger } from '../services/logger';

/**
 * Special middleware to handle Janeway Replit domains
 * This ensures that the root path in Janeway domains correctly serves index.html
 */
export function janewayRootHandler(req: Request, res: Response, next: NextFunction) {
  // Check if this is a request to the root path on a Janeway domain
  const host = req.headers.host || '';
  const isJaneway = host.includes('janeway.replit');
  const isRootPath = req.path === '/';
  
  // Log detailed information for debugging
  logger.info({
    message: `Request received: ${req.method} ${req.path}`,
    category: "system",
    source: "internal",
    metadata: { 
      host, 
      path: req.path,
      isJaneway,
      isRootPath,
      userAgent: req.headers['user-agent'] || 'unknown'
    }
  });
  
  // For the root path on Janeway domains, serve index.html directly
  if (isJaneway && isRootPath) {
    const indexPath = path.join(process.cwd(), 'client', 'dist', 'index.html');
    
    logger.info({
      message: `Janeway handler serving index.html for root path`,
      category: "system",
      source: "internal",
      metadata: { indexPath }
    });
    
    return res.sendFile(indexPath, (err) => {
      if (err) {
        logger.error({
          message: `Error serving index.html: ${err.message}`,
          category: "system",
          source: "internal",
          metadata: { 
            error: err.message,
            stack: err.stack,
            // The Express.js sendFile error may include a statusCode
            statusCode: (err as any).statusCode
          }
        });
        
        next(err);
      }
    });
  }
  
  // For all other requests, continue with normal handling
  next();
}