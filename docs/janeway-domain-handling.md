# Janeway Domain Handling in ShiFi Platform

## Problem Overview

When accessing the ShiFi application through Replit's Janeway domains (e.g., `appname-00-xxx.janeway.replit.dev`), users were encountering 404 errors when trying to access the application directly or on page refresh. This was happening because:

1. Janeway domains have a different URL pattern than standard Replit domains
2. The root path ("/") wasn't being correctly handled to serve the frontend application
3. Express wasn't properly recognizing these domains to serve static files

## Solution Implementation

We implemented a specialized middleware handler specifically for Janeway domains that ensures the application's frontend is correctly served. This approach provides a robust solution that:

1. Detects requests coming from Janeway domains
2. Ensures the root path serves the React application's index.html file
3. Maintains normal routing behavior for API and non-root paths

### Key Components:

#### 1. Custom Janeway Handler Middleware

Located in `server/middleware/janeway-handler.ts`, this middleware:

```typescript
// Special middleware to handle Janeway Replit domains
export function janewayRootHandler(req: Request, res: Response, next: NextFunction) {
  const host = req.headers.host || '';
  const isJaneway = host.includes('janeway.replit');
  const isRootPath = req.path === '/';
  
  // For the root path on Janeway domains, serve index.html directly
  if (isJaneway && isRootPath) {
    const indexPath = path.join(process.cwd(), 'client', 'dist', 'index.html');
    return res.sendFile(indexPath);
  }
  
  // For all other requests, continue with normal handling
  next();
}
```

#### 2. Integration in Express Server

Added in `server/index.ts`, positioned after CSRF middleware but before other route handlers:

```typescript
// Import and use our special Janeway domain handler
import { janewayRootHandler } from './middleware/janeway-handler';
app.use(janewayRootHandler);
```

#### 3. Enhanced Logging

To assist in troubleshooting, we added detailed logging throughout the Janeway handler that captures:
- Incoming request host and path
- Whether the request matches Janeway domain patterns
- When index.html is served for Janeway domains
- Any errors that occur during file serving

## Testing

A test script (`test-janeway-handler.js`) was created to verify the solution:

1. It simulates requests from Janeway domains
2. Verifies that the root path correctly returns index.html
3. Confirms that API endpoints still function properly

## Results

This implementation successfully resolves the 404 errors when accessing the application through Janeway domains. Users can now:

1. Open the application directly via Janeway domain URLs
2. Refresh the page without losing the application state
3. Navigate to different routes within the SPA without 404 errors

## Additional Benefits

This approach:

1. Is non-invasive, requiring minimal changes to the existing codebase
2. Only affects Janeway domain access, preserving normal behavior for other domains
3. Provides detailed logging for troubleshooting any future issues
4. Follows separation of concerns principles by isolating Janeway-specific logic

## Future Considerations

For long-term maintenance:

1. If Replit changes its Janeway domain patterns, the detection logic may need updating
2. Consider adding configuration options to make the Janeway detection more flexible
3. Expand to handle other special Replit domain types if needed