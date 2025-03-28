
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { logger, LogCategory, LogSource } from './logger';

/**
 * Enhanced custom error class with additional metadata support
 */
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
    super(options.message);
    this.statusCode = options.statusCode;
    this.isOperational = options.isOperational ?? true;
    this.errorCode = options.errorCode;
    this.source = options.source || 'internal';
    this.category = options.category || 'api';
    this.metadata = options.metadata;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Common error factory methods for consistency
 */
export const ErrorFactory = {
  /**
   * Create a validation error (400 Bad Request)
   */
  validation: (message: string, metadata?: Record<string, any>) => {
    return new AppError({
      message,
      statusCode: 400,
      errorCode: 'VALIDATION_ERROR',
      category: 'validation',
      metadata
    });
  },
  
  /**
   * Create an unauthorized error (401 Unauthorized)
   */
  unauthorized: (message = 'Authentication required', metadata?: Record<string, any>) => {
    return new AppError({
      message,
      statusCode: 401,
      errorCode: 'UNAUTHORIZED',
      category: 'auth',
      metadata
    });
  },
  
  /**
   * Create a forbidden error (403 Forbidden)
   */
  forbidden: (message = 'Access denied', metadata?: Record<string, any>) => {
    return new AppError({
      message,
      statusCode: 403,
      errorCode: 'FORBIDDEN',
      category: 'auth',
      metadata
    });
  },
  
  /**
   * Create a not found error (404 Not Found)
   */
  notFound: (entity = 'Resource', metadata?: Record<string, any>) => {
    return new AppError({
      message: `${entity} not found`,
      statusCode: 404,
      errorCode: 'NOT_FOUND',
      category: 'resource',
      metadata
    });
  },
  
  /**
   * Create a conflict error (409 Conflict)
   */
  conflict: (message: string, metadata?: Record<string, any>) => {
    return new AppError({
      message,
      statusCode: 409,
      errorCode: 'CONFLICT',
      category: 'resource',
      metadata
    });
  },
  
  /**
   * Create an internal error (500 Internal Server Error)
   */
  internal: (message = 'Internal server error', metadata?: Record<string, any>) => {
    return new AppError({
      message,
      statusCode: 500,
      errorCode: 'INTERNAL_ERROR',
      isOperational: false,
      category: 'system',
      metadata
    });
  },
  
  /**
   * Create a service unavailable error (503 Service Unavailable)
   */
  serviceUnavailable: (service: string, metadata?: Record<string, any>) => {
    return new AppError({
      message: `${service} service is currently unavailable`,
      statusCode: 503,
      errorCode: 'SERVICE_UNAVAILABLE',
      category: 'system',
      source: service.toLowerCase(),
      metadata
    });
  },
  
  /**
   * Create an error for third-party API failures
   */
  externalApi: (service: string, message: string, statusCode = 500, metadata?: Record<string, any>) => {
    return new AppError({
      message: `${service} API error: ${message}`,
      statusCode,
      errorCode: 'EXTERNAL_API_ERROR',
      category: 'api',
      source: service.toLowerCase(),
      metadata
    });
  },
  
  /**
   * Create a custom error with specified options
   */
  custom: (options: {
    message: string;
    statusCode: number;
    errorCode?: string;
    isOperational?: boolean;
    source?: string;
    category?: string;
    metadata?: Record<string, any>;
  }) => {
    return new AppError(options);
  }
};

/**
 * Extract API error details from various third-party services
 */
export const extractApiErrorDetails = (err: any): Record<string, any> | null => {
  // Handle Plaid errors
  if (err.response?.data?.error_code) {
    return {
      service: 'plaid',
      errorCode: err.response.data.error_code,
      errorType: err.response.data.error_type,
      errorMessage: err.response.data.error_message,
      displayMessage: err.response.data.display_message
    };
  }
  
  // Handle Stripe errors
  if (err.type && err.type.startsWith('stripe_')) {
    return {
      service: 'stripe',
      errorType: err.type,
      errorCode: err.code,
      param: err.param,
      requestId: err.requestId,
      message: err.message
    };
  }
  
  // Handle Twilio errors
  if (err.code && err.moreInfo && err.moreInfo.includes('twilio.com')) {
    return {
      service: 'twilio',
      errorCode: err.code,
      status: err.status,
      message: err.message,
      moreInfo: err.moreInfo
    };
  }
  
  // Handle OpenAI errors
  if (err.response?.data?.error?.type) {
    return {
      service: 'openai',
      error: err.response.data.error
    };
  }
  
  return null;
};

/**
 * Enhanced error handler middleware with improved error categorization and reporting
 */
export const errorHandler = (err: Error, req: Request, res: Response, _next: NextFunction) => {
  // Default values
  let statusCode = 500;
  let message = 'Internal Server Error';
  let errors = null;
  let errorCode = 'INTERNAL_ERROR';
  let source = 'internal';
  let category = 'api';
  let metadata: Record<string, any> = {};
  
  // Handle specific error types
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    errorCode = err.errorCode || errorCode;
    source = err.source || source;
    category = err.category || category;
    metadata = err.metadata || metadata;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Validation error';
    errorCode = 'VALIDATION_ERROR';
    category = 'validation';
    errors = fromZodError(err).details;
    metadata.zodError = err.errors;
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
    errorCode = 'INVALID_TOKEN';
    category = 'auth';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
    errorCode = 'TOKEN_EXPIRED';
    category = 'auth';
  } else {
    // Try to extract specific API error details
    const apiErrorDetails = extractApiErrorDetails(err);
    if (apiErrorDetails) {
      source = apiErrorDetails.service;
      metadata.apiError = apiErrorDetails;
      
      // Update message based on service-specific info if available
      if (apiErrorDetails.errorMessage || apiErrorDetails.message) {
        message = apiErrorDetails.errorMessage || apiErrorDetails.message;
      }
      
      // Adjust status code for some types of errors
      if (apiErrorDetails.service === 'plaid' && apiErrorDetails.errorType === 'INVALID_REQUEST') {
        statusCode = 400;
      }
    }
  }
  
  // Add request information to metadata
  metadata.requestInfo = {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent')
  };
  
  // Add error details
  metadata.errorDetails = {
    stack: err.stack,
    error: err instanceof Error ? err.message : String(err),
    errors
  };
  
  // Map category string to valid LogCategory
  const validCategory: LogCategory = 
    (category === 'validation' || category === 'security' || 
     category === 'api' || category === 'webhook' || 
     category === 'system' || category === 'notification' || 
     category === 'contract' || category === 'payment' || 
     category === 'database' || category === 'user') 
    ? (category as LogCategory) : 'api';
  
  // Map source string to valid LogSource
  const validSource: LogSource = 
    (source === 'internal' || source === 'plaid' || 
     source === 'twilio' || source === 'sendgrid' || 
     source === 'stripe' || source === 'openai') 
    ? (source as LogSource) : 'internal';
  
  // Log the error with enhanced details
  logger.error({
    message: `Error: ${message}`,
    category: validCategory,
    source: validSource,
    metadata: {
      statusCode,
      errorCode,
      originalCategory: category,
      originalSource: source,
      ...metadata
    }
  });
  
  // Development vs production error response
  const isDev = process.env.NODE_ENV === 'development';
  
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

/**
 * Async handler to avoid try/catch blocks in route handlers
 * Automatically forwards errors to the error handling middleware
 */
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
