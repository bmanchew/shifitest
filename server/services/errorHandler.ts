
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { logger } from './logger';

// Custom error class
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  
  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Error handler middleware
export const errorHandler = (err: Error, req: Request, res: Response, _next: NextFunction) => {
  // Default values
  let statusCode = 500;
  let message = 'Internal Server Error';
  let errors = null;
  
  // Handle specific error types
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Validation error';
    errors = fromZodError(err).details;
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }
  
  // Log the error
  logger.error({
    message: `Error: ${message}`,
    req,
    statusCode,
    metadata: {
      stack: err.stack,
      error: err instanceof Error ? err.message : String(err),
      errors
    }
  });
  
  // Development vs production error response
  const isDev = process.env.NODE_ENV === 'development';
  
  res.status(statusCode).json({
    success: false,
    status: statusCode,
    message,
    errors,
    ...(isDev && { stack: err.stack })
  });
};

// Async handler to avoid try/catch blocks
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
