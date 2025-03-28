# Node.js Route Organization Best Practices

## Core Principles

1. **Separation of Concerns**: Routes should be organized by feature or domain area.
2. **Hierarchical Structure**: Use a hierarchical structure that reflects the application's domain model.
3. **Consistent Naming**: Use consistent naming conventions for routes, controllers, and middleware.
4. **Middleware Layering**: Apply middleware at the appropriate level (global, router, or route).
5. **Error Handling**: Implement consistent error handling across all routes.

## Folder Structure

A well-organized Express.js application should follow a structure similar to:

```
server/
├── routes/
│   ├── index.ts         # Main router aggregation
│   ├── auth.ts          # Authentication routes
│   ├── users.ts         # User management routes
│   ├── merchants.ts     # Merchant-specific routes
│   └── payments.ts      # Payment processing routes
├── controllers/
│   ├── auth.ts          # Authentication controllers
│   ├── users.ts         # User controllers
│   └── ...
├── middleware/
│   ├── auth.ts          # Authentication middleware
│   ├── validation.ts    # Request validation middleware
│   ├── logging.ts       # Request logging middleware
│   └── error.ts         # Error handling middleware
└── index.ts             # Express app initialization
```

## Router Implementation

### Main Router

```typescript
// routes/index.ts
import express from 'express';
import authRouter from './auth';
import userRouter from './users';
import merchantRouter from './merchants';

const router = express.Router();

// Mount feature routers
router.use('/auth', authRouter);
router.use('/users', userRouter);
router.use('/merchants', merchantRouter);

export default router;
```

### Feature Router

```typescript
// routes/auth.ts
import express from 'express';
import { csrfProtection } from '../middleware/csrf';
import * as authController from '../controllers/auth';
import { validateLoginRequest } from '../middleware/validation';

const router = express.Router();

// Define routes with appropriate middleware
router.post('/login', csrfProtection, validateLoginRequest, authController.login);
router.post('/logout', csrfProtection, authController.logout);
router.post('/refresh', csrfProtection, authController.refreshToken);

export default router;
```

## Middleware Organization

### Global Middleware

Apply global middleware at the application level for concerns that affect all routes:

```typescript
// Security middleware
app.use(helmet());
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use(requestLogger);

// Mount main router after global middleware
app.use('/api', mainRouter);

// Error handling middleware should be last
app.use(errorHandler);
```

### Router-Level Middleware

Apply router-level middleware when a set of routes shares common requirements:

```typescript
// Apply authentication to all user routes
userRouter.use(authenticate);

// Define routes after middleware
userRouter.get('/profile', userController.getProfile);
userRouter.put('/profile', userController.updateProfile);
```

### Route-Level Middleware

Apply route-level middleware for route-specific requirements:

```typescript
// Apply specific middleware to individual routes
router.post('/payments', 
  authenticate,            // Authentication check
  validatePaymentRequest,  // Request validation
  rateLimit,               // Rate limiting
  paymentController.processPayment
);
```

## Path Naming Conventions

Follow these conventions for route paths:

1. **Use kebab-case for URLs**: `/user-profiles` instead of `/userProfiles`
2. **Use plural nouns for collections**: `/users` instead of `/user`
3. **Use clear, descriptive names**: `/reset-password` instead of `/reset`
4. **Nest resources appropriately**: `/merchants/:merchantId/products`
5. **Use action verbs for operations**: `/send-verification-email`

## Versioning Strategies

Consider one of these API versioning approaches:

1. **URL Path Versioning**:
   ```
   /api/v1/users
   /api/v2/users
   ```

2. **Header Versioning**:
   ```
   Accept: application/vnd.company.v1+json
   ```

3. **Query Parameter Versioning**:
   ```
   /api/users?version=1
   ```

## Error Handling

Implement consistent error handling for routes:

```typescript
// Centralized error handling middleware
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const status = err.status || 500;
  const message = err.message || 'Something went wrong';

  logger.error(`${status} - ${message}`, {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    error: err
  });

  res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}
```

## Request Validation

Use a validation library like Zod, Joi, or express-validator:

```typescript
// Validation middleware example with Zod
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export function validateLoginRequest(req, res, next) {
  try {
    loginSchema.parse(req.body);
    next();
  } catch (error) {
    next({
      status: 400,
      message: 'Invalid request data',
      errors: error.errors
    });
  }
}
```

## Authentication Integration

Properly integrate authentication with your routes:

```typescript
// Auth middleware
export function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }
  
  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
}

// Apply to routes
router.get('/protected-resource', authenticate, controller.getResource);
```

## Route Documentation

Document your routes with clear comments or tools like Swagger/OpenAPI:

```typescript
/**
 * @route POST /api/auth/login
 * @desc Authenticate user and return JWT token
 * @access Public
 * @body { email: string, password: string }
 * @returns { success: boolean, token: string, user: UserType }
 */
router.post('/login', validateLoginRequest, authController.login);
```

## Testing Strategy

Implement a comprehensive testing strategy for routes:

1. **Unit tests** for controllers and middleware
2. **Integration tests** for route handlers
3. **End-to-end tests** for critical user flows

```typescript
// Example integration test for authentication route
describe('POST /api/auth/login', () => {
  it('should return 200 and token for valid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });
      
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
    expect(response.body).toHaveProperty('user');
  });
  
  it('should return 401 for invalid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'wrongpassword'
      });
      
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('message');
  });
});
```

## Performance Considerations

Optimize your routes for performance:

1. **Pagination** for collection endpoints
2. **Query optimization** for database operations
3. **Caching** for frequently accessed resources
4. **Rate limiting** for public endpoints
5. **Compression** for response payload

## Scaling Concerns

Design routes with scaling in mind:

1. **Statelessness**: Ensure routes don't rely on server-side state
2. **Idempotence**: Make operations safely repeatable
3. **Throttling**: Implement rate limiting for high-traffic endpoints
4. **Graceful degradation**: Handle service dependencies gracefully

## Security Best Practices

Implement security best practices for routes:

1. **Input validation** for all request parameters
2. **CSRF protection** for browser-based clients
3. **Proper authentication** for protected resources
4. **Rate limiting** to prevent brute force attacks
5. **Content security policy** for browser interactions