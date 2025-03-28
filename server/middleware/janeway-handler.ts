import { Request, Response, NextFunction, Router } from 'express';
import path from 'path';
import { logger } from '../services/logger';
import fs from 'fs';

/**
 * Helper function to detect if request is from a Janeway domain
 * @param req Express Request
 * @returns Boolean indicating if request is from a Janeway domain
 */
export function isJanewayDomain(req: Request): boolean {
  const host = req.headers.host || '';
  // Check for both development and production Janeway domains
  return host.includes('janeway.replit');
}

/**
 * Helper function to check if request is for a static asset
 * @param path Request path
 * @returns Boolean indicating if request is for a static asset
 */
export function isStaticAsset(path: string): boolean {
  // Comprehensive list of static asset extensions
  const assetExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.map', '.json'];
  
  // Check if path starts with any asset directories or has an asset extension
  return path.startsWith('/assets/') || 
         path.startsWith('/static/') || 
         path.startsWith('/images/') || 
         path.startsWith('/img/') || 
         assetExtensions.some(ext => path.endsWith(ext));
}

/**
 * Special middleware to handle Janeway Replit domains
 * This ensures that the root path in Janeway domains correctly serves index.html
 */
export function janewayRootHandler(req: Request, res: Response, next: NextFunction) {
  // Get detailed request information
  const isJaneway = isJanewayDomain(req);
  const isRootPath = req.path === '/';
  
  // Log detailed information for debugging
  logger.info({
    message: `Request received: ${req.method} ${req.path}`,
    category: "system",
    source: "internal",
    metadata: { 
      host: req.headers.host || 'unknown', 
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
    if (isStaticAsset(req.path)) {
      return next();
    }
    
    // For all non-API, non-asset routes on Janeway, serve index.html
    // Use an absolute path to be super explicit
    const indexPath = path.resolve('./client/dist/index.html');
    
    // Check if the file exists first
    if (!fs.existsSync(indexPath)) {
      logger.error({
        message: `Index.html file not found at ${indexPath}`,
        category: "system",
        source: "internal",
        metadata: {
          path: req.path,
          indexPath,
          cwd: process.cwd()
        }
      });
      return next();
    }
    
    logger.info({
      message: `Janeway handler serving index.html for path: ${req.path}`,
      category: "system",
      source: "internal",
      metadata: { indexPath }
    });
    
    // Set proper content type before sending
    res.set('Content-Type', 'text/html');
    
    // Send the file with explicit status and options
    return res.status(200).sendFile(indexPath, (err) => {
      if (err) {
        logger.error({
          message: `Error serving index.html: ${err.message}`,
          category: "system",
          source: "internal",
          metadata: { 
            error: err.message,
            stack: err.stack,
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
  
  // Add routes for common client-side routes to ensure proper handling
  // These explicit routes take precedence over the catch-all
  const clientRoutes = [
    '/login', 
    '/dashboard', 
    '/settings', 
    '/admin/*', 
    '/profile',
    '/merchants',
    '/contracts',
    '/notifications'
  ];
  
  // Register explicit routes for common client paths
  clientRoutes.forEach(route => {
    router.get(route, handleJanewayClientRoute);
  });
  
  // Catch-all route for any other paths (mounted after API and explicit routes)
  router.get('*', handleJanewayClientRoute);
  
  return router;
}

/**
 * Handler function for Janeway client routes
 * Extracted to avoid code duplication
 */
function handleJanewayClientRoute(req: Request, res: Response, next: NextFunction) {
  // Only handle Janeway domain requests
  if (!isJanewayDomain(req)) {
    return next();
  }
  
  // Skip API requests
  if (req.path.startsWith('/api/')) {
    return next();
  }
  
  // Skip static asset requests
  if (isStaticAsset(req.path)) {
    return next();
  }
  
  // For all non-API, non-asset routes on Janeway domains, serve the SPA's index.html
  // Use absolute path with path.resolve for maximum reliability
  const indexPath = path.resolve('./client/dist/index.html');
  
  // Check if the file exists first
  if (!fs.existsSync(indexPath)) {
    logger.error({
      message: `Index.html file not found at ${indexPath}`,
      category: "system",
      source: "internal",
      metadata: {
        path: req.path,
        indexPath,
        cwd: process.cwd()
      }
    });
    return next();
  }
  
  logger.info({
    message: `[Catch-all] Janeway router serving index.html for path: ${req.path}`,
    category: "system",
    source: "internal",
    metadata: { 
      path: req.path,
      host: req.headers.host || 'unknown',
      indexPath
    }
  });
  
  // Set proper content type and serve
  res.set('Content-Type', 'text/html');
  return res.status(200).sendFile(indexPath);
}