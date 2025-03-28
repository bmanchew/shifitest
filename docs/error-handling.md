# ShiFi Error Handling System

This document outlines the enhanced error handling system in the ShiFi platform, which provides consistent, detailed error reporting and handling across the application.

## Overview

The error handling system is built around several key components:

1. **AppError Class**: A custom error class that extends the standard JavaScript Error class with additional metadata.
2. **ErrorFactory**: A factory for creating specific types of errors with consistent properties.
3. **Error Handler Middleware**: Express middleware that processes errors and sends appropriate responses.
4. **Async Handler Utility**: A wrapper for async route handlers to avoid try/catch blocks.
5. **API Error Extraction**: Utility to extract detailed information from third-party API errors.

## AppError Class

```typescript
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  errorCode?: string;
  source?: string;
  category?: string;
  metadata?: Record<string, any>;
  
  constructor(options: {
    message: string;
    statusCode: number;
    isOperational?: boolean;
    errorCode?: string;
    source?: string;
    category?: string;
    metadata?: Record<string, any>;
  }) {
    // ...implementation
  }
}
```

### Properties

- **statusCode**: HTTP status code to be returned (e.g., 400, 401, 404, 500)
- **isOperational**: Indicates if the error is operational (expected) or programming (unexpected)
- **errorCode**: A machine-readable error code (e.g., "VALIDATION_ERROR", "NOT_FOUND")
- **source**: The source of the error (e.g., "internal", "plaid", "stripe")
- **category**: The category of the error (e.g., "api", "validation", "auth")
- **metadata**: Additional information about the error

## ErrorFactory

The ErrorFactory provides methods for creating common types of errors:

```typescript
export const ErrorFactory = {
  validation: (message, metadata) => { /* ... */ },
  unauthorized: (message, metadata) => { /* ... */ },
  forbidden: (message, metadata) => { /* ... */ },
  notFound: (entity, metadata) => { /* ... */ },
  conflict: (message, metadata) => { /* ... */ },
  internal: (message, metadata) => { /* ... */ },
  serviceUnavailable: (service, metadata) => { /* ... */ },
  externalApi: (service, message, statusCode, metadata) => { /* ... */ },
  custom: (options) => { /* ... */ }
};
```

### Usage Examples

```typescript
// Create a validation error
throw ErrorFactory.validation('Invalid email format');

// Create a not found error
throw ErrorFactory.notFound('User');

// Create a service unavailable error
throw ErrorFactory.serviceUnavailable('Plaid');

// Create an external API error
throw ErrorFactory.externalApi('Stripe', 'Invalid API key', 401);
```

## Error Handler Middleware

The error handler middleware processes all errors thrown in the application and:

1. Formats the error response consistently
2. Provides appropriate status codes
3. Logs detailed information about the error
4. Limits sensitive information in production

```typescript
export const errorHandler = (err, req, res, _next) => {
  // ... implementation
  
  res.status(statusCode).json({
    success: false,
    status: statusCode,
    message,
    errorCode,
    errors,
    ...(isDev && { 
      stack: err.stack,
      apiErrorDetails: metadata.apiError
    })
  });
};
```

## Async Handler Utility

The asyncHandler utility wraps async route handlers to avoid try/catch blocks:

```typescript
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
```

### Usage Example

```typescript
app.get('/api/users/:id', asyncHandler(async (req, res) => {
  const user = await storage.getUser(req.params.id);
  
  if (!user) {
    throw ErrorFactory.notFound('User');
  }
  
  res.json(user);
}));
```

## API Error Extraction

The extractApiErrorDetails utility extracts information from third-party API errors:

```typescript
export const extractApiErrorDetails = (err) => {
  // Handle Plaid errors
  if (err.response?.data?.error_code) {
    return {
      service: 'plaid',
      errorCode: err.response.data.error_code,
      // ...
    };
  }
  
  // Handle Stripe errors
  if (err.type && err.type.startsWith('stripe_')) {
    // ...
  }
  
  // Handle other services...
};
```

## Testing

The error handling system includes test scripts to verify its functionality:

1. Testing AppError class and ErrorFactory
2. Testing API error responses
3. Testing validation errors
4. Testing CSRF protection

Run the tests using:

```bash
node test-error-handling.cjs
```

## Error Categories and Sources

### Categories

- `api`: Errors related to API endpoints
- `validation`: Errors related to input validation
- `auth`: Errors related to authentication and authorization
- `resource`: Errors related to database resources
- `system`: System-level errors
- `payment`: Payment-related errors
- `notification`: Notification-related errors
- `user`: User-related errors
- `contract`: Contract-related errors
- `database`: Database-related errors

### Sources

- `internal`: Errors from the internal system
- `plaid`: Errors from Plaid API
- `stripe`: Errors from Stripe API
- `twilio`: Errors from Twilio API
- `sendgrid`: Errors from SendGrid API
- `openai`: Errors from OpenAI API

## Best Practices

1. **Use ErrorFactory**: Always use the ErrorFactory to create errors for consistent handling.
2. **Be Specific**: Use the most specific error type that applies.
3. **Provide Context**: Include enough information in the error message to help diagnose issues.
4. **Include Metadata**: Add relevant metadata to errors when it helps with debugging.
5. **Use AsyncHandler**: Wrap async route handlers with asyncHandler to avoid try/catch blocks.
6. **Operational vs Programming Errors**: Mark errors as operational (true) or programming (false) using the isOperational flag.