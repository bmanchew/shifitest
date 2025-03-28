# Janeway Domain Handling System

## Overview

This document explains the implementation of our Janeway domain handler, which ensures the application properly serves the Single Page Application (SPA) when accessed through Replit's janeway.replit.dev domains.

## Problem Statement

When a React/Vite application is hosted on Replit and accessed through the Janeway webview (via URLs like `appname-xxxx.janeway.replit.dev`), there are several unique challenges:

1. React router expects to handle all client-side routing
2. Direct navigation to routes other than the root path (e.g., `/login`, `/dashboard`) was resulting in 404 errors
3. Standard SPA serving approaches were not always effective in the Janeway environment
4. API endpoints still needed to function normally

## Implementation

We implemented a robust solution with multiple layers:

### 1. Janeway Domain Detection

The system detects requests coming from Janeway domains by examining the `Host` header:

```typescript
// Middleware to detect if request is from a Janeway domain
export function isJanewayDomain(req: Request): boolean {
  const host = req.headers.host || '';
  return host.includes('janeway.replit.dev');
}
```

### 2. Specialized Janeway Router

We created a dedicated Express router with a catch-all route specifically for Janeway domains:

```typescript
export function setupJanewayRouter(): Router {
  const router = Router();
  
  router.get('*', (req: Request, res: Response, next: NextFunction) => {
    // Skip API routes and static asset requests
    if (
      req.path.startsWith('/api/') || 
      req.path.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff|woff2|ttf|eot|map|json)$/)
    ) {
      return next();
    }
    
    // Only handle Janeway domain requests
    if (!isJanewayDomain(req)) {
      return next();
    }
    
    // Log the Janeway route being handled
    logger.info({
      message: `Janeway handler serving index.html for path: ${req.path}`,
      category: "system",
      source: "internal",
      metadata: {
        indexPath: path.resolve('./client/dist/index.html')
      }
    });
    
    // Serve the index.html for all client-side routes
    res.set('Content-Type', 'text/html');
    res.status(200).sendFile('index.html', { root: './client/dist' });
  });
  
  return router;
}
```

### 3. Integration in Main Router

The Janeway router is registered in the main `routes.ts` file:

```typescript
// Set up the Janeway catch-all router
const janewayRouter = setupJanewayRouter();
app.use(janewayRouter);
```

### 4. Order of Middleware

The middleware registration order is critical:

1. API router is mounted first at `/api`
2. Janeway router is registered next to handle Janeway domain requests
3. Static file middleware follows to serve assets
4. Standard SPA catch-all route is registered last as a fallback

## Testing

A specialized test script (`test-janeway-handler.js`) verifies:

1. All client routes (`/`, `/login`, `/dashboard`, etc.) correctly serve `index.html` on Janeway domains
2. API endpoints continue to function properly
3. Static assets are served with correct MIME types

## Benefits

This implementation provides several benefits:

1. **Robust Routing**: Works reliably across all client-side routes
2. **API Compatibility**: Preserves API functionality
3. **Improved Developer Experience**: Makes the application work seamlessly in the Replit environment
4. **Maintainability**: Centralizes Janeway-specific logic in dedicated files

## Notes for Future Development

When making changes to routing or static file serving:

1. Don't modify the Janeway router registration order
2. Test both regular domains and Janeway domains
3. Use the provided test script to verify all paths work correctly
4. Remember that the Janeway handler takes precedence for non-API routes on Janeway domains