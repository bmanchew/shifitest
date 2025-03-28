# Node.js Route Organization Best Practices

## Overview

This document outlines the route organization patterns implemented in the ShiFi platform, focusing on the modularization of Express.js routes for improved maintainability, scalability, and debugging.

## Key Routing Concepts

### 1. Modular Router Architecture

The ShiFi platform employs a modular router architecture where routes are organized by feature area:

```
server/
  └── routes/
      ├── api.js           # Main API router that aggregates all feature routers
      ├── auth.js          # Authentication routes
      ├── users.js         # User management
      ├── merchant.js      # Merchant-specific features
      ├── contracts.js     # Contract management
      ├── admin/           # Admin area with sub-features
      │   ├── index.js     # Main admin router
      │   └── reports.js   # Admin reports
      └── ...
```

This organization follows the "separation of concerns" principle, making the codebase more maintainable.

### 2. Router Aggregation Pattern

The main `routes.ts` file aggregates all feature-specific routers:

```typescript
// Create the main API router
const apiRouter = express.Router();

// Mount feature-specific routers
apiRouter.use("/auth", authRouter);
apiRouter.use("/users", userRouter);
apiRouter.use("/merchants", merchantRouter);
// ... more feature routers

// Mount the API router at /api
app.use("/api", apiRouter);
```

### 3. Client-Side Routing Support

The server properly handles client-side routing by:

1. Serving static assets with correct MIME types:
```typescript
// Configure static file serving with proper MIME types
app.use(express.static('./client/dist', {
  setHeaders: (res, path) => {
    if (path.endsWith('.js') || path.endsWith('.mjs')) {
      res.set('Content-Type', 'application/javascript');
    } else if (path.endsWith('.css')) {
      res.set('Content-Type', 'text/css');
    }
  }
}));
```

2. Handling non-API routes for SPA navigation:
```typescript
// Send index.html for all non-API routes to support SPA routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.match(/\.(js|css|png|jpg|...)$/)) {
    return next();
  }
  
  res.set('Content-Type', 'text/html');
  res.status(200).sendFile('index.html', { root: './client/dist' });
});
```

## Middleware Organization

### 1. Common Middleware

Common middleware is applied globally:

```typescript
// Global middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(requestLogger);
```

### 2. Route-Specific Middleware

Feature-specific middleware is applied at the router level:

```typescript
// In auth.js
const authRouter = express.Router();
authRouter.use(csrfProtection);
authRouter.use(sessionValidator);
```

## Error Handling

### 1. Centralized Error Handling

All routes use centralized error handling:

```typescript
// Error logger middleware - captures and logs errors
app.use(errorLoggerMiddleware);

// Global error handler - formats and returns errors
app.use((err, req, res, next) => {
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Internal Server Error',
    errors: err.errors
  });
});
```

### 2. Route-Specific Error Handling

Feature routers can implement specific error handling logic:

```typescript
authRouter.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({
      success: false,
      message: 'Invalid CSRF token',
      code: 'CSRF_ERROR'
    });
  }
  next(err);
});
```

## Logging Strategy

### 1. Request Logging

All requests are logged with detailed information:

```typescript
logger.info({
  message: `API Request: ${req.method} ${req.originalUrl}`,
  category: "api",
  metadata: {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('user-agent')
  }
});
```

### 2. Error Logging

Errors are logged with comprehensive details:

```typescript
logger.error({
  message: `API Error: ${err.message}`,
  category: "api",
  metadata: {
    path: req.path,
    method: req.method,
    statusCode: err.status || 500,
    stack: err.stack
  }
});
```

## Path Management

### 1. API Path Structure

The platform follows a consistent API path structure:

```
/api/{feature}/{resource}/{action}
```

Examples:
- `/api/auth/login` - Authentication feature, login action
- `/api/merchants/{id}/contracts` - Merchant feature, contracts resource
- `/api/admin/reports/generate` - Admin feature, reports subfeature, generate action

### 2. Path Parameters

Path parameters follow consistent patterns:

```typescript
// Resource identifier
router.get("/:id", getResourceById);

// Nested resources
router.get("/:merchantId/contracts", getMerchantContracts);

// Action on resource
router.post("/:id/approve", approveResource);
```

## Client-Side Communication

### 1. CSRF Protection

API endpoints are protected with CSRF tokens:

```typescript
// CSRF token endpoint
app.get("/api/csrf-token", (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Protected routes
apiRouter.use(csrfProtection);
```

### 2. API Response Format

All API responses follow a consistent format:

```typescript
// Success response
res.status(200).json({
  success: true,
  data: result
});

// Error response
res.status(400).json({
  success: false,
  message: "Invalid input",
  errors: validationErrors
});
```

## Testing Routes

### 1. Endpoint Testing

Each endpoint is tested with dedicated test scripts:

```javascript
// test-login-routes.js
async function testLoginEndpoint() {
  const csrfToken = await fetchCsrfToken();
  const response = await axios.post("/api/auth/login", 
    { email, password },
    { headers: { "csrf-token": csrfToken } }
  );
  
  // Assert response
}
```

### 2. Error Scenario Testing

Error scenarios are explicitly tested:

```javascript
async function testInvalidCredentials() {
  // Test with invalid credentials
  // Assert 401 status and error message
}

async function testMissingCsrfToken() {
  // Test without CSRF token
  // Assert 403 status and CSRF error message
}
```

## Conclusion

These Node.js route organization patterns provide a robust foundation for scalable, maintainable API development. The modular approach ensures that features can be developed, tested, and maintained independently while maintaining consistency across the platform.