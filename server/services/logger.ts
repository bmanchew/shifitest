/**
 * Enhanced logging service
 * 
 * Provides structured logging with severity levels, categories, and metadata.
 * In a production environment, this could be extended to log to external services.
 */
import { Request, Response, NextFunction } from 'express';

// Log categories
export type LogCategory = 
  | "user" 
  | "security" 
  | "api" 
  | "webhook"
  | "system"
  | "notification" 
  | "contract"
  | "payment"
  | "database"
  | "realtime"
  | "investor"
  | "email"
  | "sms"
  | "underwriting"
  | "blockchain"
  | "plaid"
  | "external";

// Log sources
export type LogSource = 
  | "internal" 
  | "plaid" 
  | "twilio" 
  | "sendgrid" 
  | "stripe" 
  | "openai"
  | "sesameai"
  | "api"
  | "investor"
  | "blockchain"
  | "didit"
  | "signing"
  | "thanksroger"
  | "prefi"
  | "nlpearl"
  | "cfpb";

// Base log interface
interface BaseLog {
  message: string;
  category: LogCategory;
  source?: LogSource;
  userId?: number;
  metadata?: Record<string, any>;
  tags?: string[];
  timestamp?: Date;
}

// Exports for use in the application
export const logger = {
  /**
   * Log an info message
   * @param log Log data or message string
   * @param metadata Optional metadata when using string message format
   */
  info(log: BaseLog | string, metadata?: Record<string, any>): void {
    if (typeof log === 'string') {
      // Convert string format to BaseLog format
      const baseLog: BaseLog = {
        message: log,
        category: metadata?.category || 'system',
        metadata: metadata
      };
      logToConsole('info', baseLog);
    } else {
      logToConsole('info', log);
    }
    // In production, additional logging to external services would occur here
  },
  
  /**
   * Log a warning message
   * @param log Log data or message string
   * @param metadata Optional metadata when using string message format
   */
  warn(log: BaseLog | string, metadata?: Record<string, any>): void {
    if (typeof log === 'string') {
      // Convert string format to BaseLog format
      const baseLog: BaseLog = {
        message: log,
        category: metadata?.category || 'system',
        metadata: metadata
      };
      logToConsole('warn', baseLog);
    } else {
      logToConsole('warn', log);
    }
    // In production, additional logging to external services would occur here
  },
  
  /**
   * Log an error message
   * @param log Log data or message string
   * @param metadata Optional metadata when using string message format
   */
  error(log: BaseLog | string, metadata?: Record<string, any>): void {
    if (typeof log === 'string') {
      // Convert string format to BaseLog format
      const baseLog: BaseLog = {
        message: log,
        category: metadata?.category || 'system',
        metadata: metadata
      };
      logToConsole('error', baseLog);
    } else {
      logToConsole('error', log);
    }
    // In production, additional logging to external services would occur here
  },
  
  /**
   * Log a debug message
   * @param log Log data or message string
   * @param metadata Optional metadata when using string message format
   */
  debug(log: BaseLog | string, metadata?: Record<string, any>): void {
    // Only log debug messages in development
    if (process.env.NODE_ENV !== 'production') {
      if (typeof log === 'string') {
        // Convert string format to BaseLog format
        const baseLog: BaseLog = {
          message: log,
          category: metadata?.category || 'system',
          metadata: metadata
        };
        logToConsole('debug', baseLog);
      } else {
        logToConsole('debug', log);
      }
      // In production, additional logging to external services would occur here
    }
  }
};

/**
 * Request logger middleware for Express
 * Logs details about incoming requests
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  // Skip logging for non-API endpoints to reduce noise
  if (!req.path.startsWith('/api/')) {
    return next();
  }
  
  // Log request start
  logger.info({
    message: `${req.method} ${req.path} - Request started`,
    category: 'api',
    source: 'internal',
    metadata: {
      method: req.method,
      path: req.path,
      query: req.query,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      userId: req.user?.id
    }
  });
  
  // Record start time
  const start = Date.now();
  
  // Log response details once the request is complete
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // Determine log level based on status code
    const logLevel = res.statusCode >= 500 
      ? 'error' 
      : (res.statusCode >= 400 ? 'warn' : 'info');
    
    // Log request completion
    if (logLevel === 'error') {
      logger.error({
        message: `${req.method} ${req.path} ${res.statusCode} - Completed in ${duration}ms`,
        category: 'api',
        source: 'internal',
        userId: req.user?.id,
        metadata: {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          ip: req.ip
        }
      });
    } else if (logLevel === 'warn') {
      logger.warn({
        message: `${req.method} ${req.path} ${res.statusCode} - Completed in ${duration}ms`,
        category: 'api',
        source: 'internal',
        userId: req.user?.id,
        metadata: {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          ip: req.ip
        }
      });
    } else {
      logger.info({
        message: `${req.method} ${req.path} ${res.statusCode} - Completed in ${duration}ms`,
        category: 'api',
        source: 'internal',
        userId: req.user?.id,
        metadata: {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          ip: req.ip
        }
      });
    }
  });
  
  next();
};

/**
 * Log to console with formatted output
 * @param level Log level
 * @param log Log data
 */
function logToConsole(level: 'info' | 'warn' | 'error' | 'debug', log: BaseLog): void {
  const timestamp = log.timestamp || new Date();
  const formattedTimestamp = timestamp.toISOString();
  
  // Format the log message
  const formattedLog = {
    level,
    timestamp: formattedTimestamp,
    message: log.message,
    category: log.category,
    source: log.source || 'internal',
    ...(log.userId ? { userId: log.userId } : {}),
    ...(log.metadata ? { metadata: sanitizeMetadata(log.metadata) } : {}),
    ...(log.tags && log.tags.length > 0 ? { tags: log.tags } : {})
  };
  
  // Log to console with appropriate level
  switch (level) {
    case 'info':
      console.info(JSON.stringify(formattedLog));
      break;
    case 'warn':
      console.warn(JSON.stringify(formattedLog));
      break;
    case 'error':
      console.error(JSON.stringify(formattedLog));
      break;
    case 'debug':
      console.debug(JSON.stringify(formattedLog));
      break;
  }
}

/**
 * Sanitize metadata to remove sensitive information
 * @param metadata Object containing metadata
 * @returns Sanitized metadata
 */
function sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
  const sanitized = { ...metadata };
  
  // List of keys that might contain sensitive information
  const sensitiveKeys = [
    'password', 'token', 'secret', 'apiKey', 'api_key', 'key',
    'authorization', 'auth', 'credential', 'credentials',
    'ssn', 'social_security', 'socialSecurity',
    'creditCard', 'credit_card', 'card_number', 'cardNumber',
    'cvv', 'cvc', 'pin'
  ];
  
  // Recursively sanitize objects
  function recursiveSanitize(obj: Record<string, any>): Record<string, any> {
    for (const key in obj) {
      // Skip if the property doesn't exist
      if (!Object.prototype.hasOwnProperty.call(obj, key)) {
        continue;
      }
      
      // Check if the key is sensitive
      const lowerKey = key.toLowerCase();
      const isSensitive = sensitiveKeys.some(k => lowerKey.includes(k.toLowerCase()));
      
      if (isSensitive && typeof obj[key] === 'string') {
        // Mask sensitive values
        obj[key] = '***REDACTED***';
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        // Recursively sanitize nested objects
        obj[key] = recursiveSanitize(obj[key]);
      }
    }
    
    return obj;
  }
  
  return recursiveSanitize(sanitized);
}