import { Request, Response, NextFunction, Router } from 'express';
import path from 'path';
import { logger } from '../services/logger';
import fs from 'fs';

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
  
  // For requests on Janeway domains that aren't API calls or static assets
  if (isJaneway) {
    // Skip API requests to allow them to be handled normally
    if (req.path.startsWith('/api/')) {
      return next();
    }
    
    // Skip static asset requests (they should be handled by static middleware)
    if (req.path.startsWith('/assets/') || 
        req.path.endsWith('.js') || 
        req.path.endsWith('.css') || 
        req.path.endsWith('.png') || 
        req.path.endsWith('.jpg') || 
        req.path.endsWith('.svg')) {
      return next();
    }
    
    // For all non-API, non-asset routes on Janeway, serve index.html
    const indexPath = path.join(process.cwd(), 'client', 'dist', 'index.html');
    
    // Check if the file exists first
    if (!fs.existsSync(indexPath)) {
      logger.error({
        message: `Index.html file not found at ${indexPath}`,
        category: "system",
        source: "internal"
      });
      return next();
    }
    
    logger.info({
      message: `Janeway handler serving index.html for path: ${req.path}`,
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

/**
 * Configure an Express Router with a catch-all route for handling all non-API paths in Janeway
 * This is a stronger approach than middleware if the middleware approach isn't working
 */
export function setupJanewayRouter(): Router {
  const router = Router();
  
  // Catch-all route for Janeway domains (mounted after API routes)
  router.get('*', (req: Request, res: Response, next: NextFunction) => {
    const host = req.headers.host || '';
    const isJaneway = host.includes('janeway.replit');
    
    if (isJaneway) {
      // Skip API requests
      if (req.path.startsWith('/api/')) {
        return next();
      }
      
      // Skip static asset requests
      if (req.path.startsWith('/assets/') || 
          req.path.endsWith('.js') || 
          req.path.endsWith('.css') || 
          req.path.endsWith('.png') || 
          req.path.endsWith('.jpg') || 
          req.path.endsWith('.svg')) {
        return next();
      }
      
      // For all other routes on Janeway domains, serve the SPA's index.html
      const indexPath = path.join(process.cwd(), 'client', 'dist', 'index.html');
      
      logger.info({
        message: `[Catch-all] Janeway router serving index.html for path: ${req.path}`,
        category: "system",
        source: "internal",
        metadata: { 
          path: req.path,
          host: host,
          indexPath
        }
      });
      
      return res.sendFile(indexPath);
    }
    
    // For non-Janeway requests, continue with normal handling
    next();
  });
  
  return router;
}