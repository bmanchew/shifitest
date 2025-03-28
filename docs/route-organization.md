# Node.js Route Organization in ShiFi Platform

## Current Structure

The ShiFi platform uses a modular Express.js routing system with the following components:

1. **Main Router** - Aggregates and manages all feature-specific routes (`server/routes.ts`)
2. **Feature Routers** - Organized by domain functionality (auth, users, merchants, etc.)
3. **Middleware Integration** - Security and logging middleware attached at appropriate levels

## Route Resolution Pattern

The platform uses a hierarchical route structure with these paths:

- Base API routes at `/api/...`
- Feature-specific routes at `/api/{feature}/...` 
- Version-specific routes at `/api/v1/{feature}/...` (where applicable)

## Authentication Routes

All authentication-related endpoints are protected with CSRF validation to prevent cross-site request forgery attacks. The key auth routes include:

- `/api/auth/login` - User login endpoint (POST)
- `/api/auth/logout` - User logout endpoint (POST)
- `/api/auth/refresh` - Token refresh endpoint (POST)
- `/api/csrf-token` - CSRF token generation endpoint (GET)

## CSRF Protection

The platform employs a robust CSRF protection scheme:

1. Clients must first fetch a CSRF token from `/api/csrf-token`
2. The token is then included in subsequent request headers as `CSRF-Token`
3. The server validates this token against the session cookie
4. Requests without valid tokens receive a 403 Forbidden response

## Debugging Routes

When troubleshooting route issues, consider:

1. **Path Resolution** - Ensure the client is using the exact path defined in the router
2. **CSRF Token Handling** - Check that CSRF tokens are properly acquired and sent
3. **Middleware Execution** - Review middleware order, especially for authentication checks
4. **Error Responses** - Distinguish between 404 (route not found) and 403 (access denied) responses

## Best Practices for Route Organization

1. **Feature-Based Grouping** - Group routes by domain functionality
2. **Consistent Naming** - Use consistent path patterns across the application
3. **Middleware Layering** - Apply middleware at the appropriate level (global, router, or route)
4. **Path Parameters** - Use descriptive parameter names in route paths
5. **Version Management** - Support versioning through path prefixes or headers

## Middleware Structure

Middleware is applied in layers:

1. **Global Middleware** - Applied to all routes (logging, security headers)
2. **Router Middleware** - Applied to specific feature routers (authentication)
3. **Route Middleware** - Applied to individual routes (validation, permissions)

## Monitoring and Debugging

The application includes extensive logging for route activity:

- Request logging with method, path, query parameters
- Response logging with status code and timing
- CSRF validation results
- Authentication checks

Use these logs to identify issues with route resolution and request handling.