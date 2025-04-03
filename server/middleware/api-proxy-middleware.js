/**
 * Middleware that handles API routes before they reach the Vite middleware
 * This middleware runs before the wildcard Vite middleware that would otherwise
 * intercept all requests, including API calls.
 */
export function apiProxyMiddleware(req, res, next) {
  // Only intercept API routes
  if (req.path.startsWith('/api/')) {
    console.log(`[API PROXY] Detected API route: ${req.path}`);
    
    // Specific handling for dedicated routers
    if (req.path.startsWith('/api/application-progress') || 
        req.path.startsWith('/api/documents') ||
        req.path.startsWith('/api/current-merchant') ||
        req.path.startsWith('/api/v1/current-merchant')) {
      console.log(`[API PROXY] Routing API request to Express: ${req.path}`);
      return next();
    }
    
    // For all other API routes, let Express handle them
    console.log(`[API PROXY] Routing API request to Express: ${req.path}`);
    return next();
  }
  
  // Not an API route, let Vite handle it
  console.log(`[API PROXY] Passing non-API route to Vite: ${req.path}`);
  return next();
}