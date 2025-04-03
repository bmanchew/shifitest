import { Request, Response, NextFunction } from 'express';

/**
 * Middleware that handles API routes before they reach the Vite middleware
 * This middleware runs before the wildcard Vite middleware that would otherwise
 * intercept all requests, including API calls.
 */
export function apiProxyMiddleware(req: Request, res: Response, next: NextFunction) {
  // Check if request is to an API endpoint
  if (req.path.startsWith('/api/')) {
    // Add debugging information to help diagnose routing issues
    console.log(`API Proxy Middleware: Handling ${req.method} ${req.path}`);
    
    // If the response was already sent by an earlier API route handler
    // (like in routes/index.ts), let it pass through
    if (res.headersSent) {
      console.log(`API Proxy Middleware: Response already sent for ${req.path}, passing through`);
      return;
    }
    
    // If no API route handler sent a response yet (meaning we reached this middleware),
    // the API route doesn't exist. Send a 404 error instead of letting Vite serve the React app.
    console.log(`API Proxy Middleware: No handler found for ${req.path}, sending 404`);
    return res.status(404).json({
      success: false,
      error: `API endpoint not found: ${req.path}`,
      code: 'API_NOT_FOUND'
    });
  }
  
  // For non-API routes, continue to the next middleware (which will be Vite)
  next();
}