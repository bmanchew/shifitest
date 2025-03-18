import { v4 as uuidv4 } from 'uuid';
import { storage } from '../storage';
import { Request } from 'express';
import { InsertLog, logLevelEnum, logCategoryEnum, logSourceEnum } from '@shared/schema';

// Interface for log entry options
export interface LogOptions {
  level?: typeof logLevelEnum.enumValues[number];
  category?: typeof logCategoryEnum.enumValues[number];
  message: string;
  userId?: number;
  source?: typeof logSourceEnum.enumValues[number];
  requestId?: string;
  correlationId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  tags?: string[];
  duration?: number;
  statusCode?: number;
  retentionDays?: number;
  req?: Request;
}

// Generate a unique correlation ID if none provided
const generateCorrelationId = (): string => {
  return uuidv4();
};

// Current correlation ID for the request chain
let currentCorrelationId: string | null = null;

// Set the correlation ID for the current context
export const setCorrelationId = (id: string): void => {
  currentCorrelationId = id;
};

// Get the current correlation ID
export const getCorrelationId = (): string => {
  if (!currentCorrelationId) {
    currentCorrelationId = generateCorrelationId();
  }
  return currentCorrelationId;
};

// Reset the correlation ID (typically at the end of a request)
export const resetCorrelationId = (): void => {
  currentCorrelationId = null;
};

// Extract request information
const extractRequestInfo = (req: Request): { ipAddress: string; userAgent: string } => {
  const ipAddress = 
    req.headers['x-forwarded-for'] as string || 
    req.socket.remoteAddress || 
    'unknown';
    
  const userAgent = req.headers['user-agent'] || 'unknown';
  
  return { ipAddress, userAgent };
};

// Format metadata as JSON string - metadata can be either an object or already stringified JSON
const formatMetadata = (metadata: Record<string, any> | string | undefined): string | undefined => {
  if (!metadata) return undefined;
  
  // If it's already a string, return it directly
  if (typeof metadata === 'string') return metadata;
  
  try {
    return JSON.stringify(metadata);
  } catch (error) {
    console.error('Error stringifying metadata:', error);
    return JSON.stringify({ error: 'Failed to stringify original metadata' });
  }
};

// Main Logger class
class Logger {
  // Log at a specific level
  private async logWithLevel(
    level: typeof logLevelEnum.enumValues[number], 
    options: Omit<LogOptions, 'level'>
  ): Promise<void> {
    try {
      const correlationId = options.correlationId || getCorrelationId();
      const requestId = options.requestId || uuidv4().substring(0, 8);
      
      let ipAddress = options.ipAddress;
      let userAgent = options.userAgent;
      
      // Extract IP and user agent from request if provided
      if (options.req) {
        const requestInfo = extractRequestInfo(options.req);
        ipAddress = ipAddress || requestInfo.ipAddress;
        userAgent = userAgent || requestInfo.userAgent;
      }
      
      // Create log entry object
      const logEntry: InsertLog = {
        level,
        category: (options.category || 'system').toLowerCase(),
        message: options.message,
        userId: options.userId,
        source: options.source || 'internal',
        requestId,
        correlationId,
        metadata: formatMetadata(options.metadata),
        ipAddress,
        userAgent,
        tags: options.tags,
        duration: options.duration,
        statusCode: options.statusCode,
        retentionDays: options.retentionDays,
      };
      
      // Store log entry
      await storage.createLog(logEntry);
      
      // Also log to console for debugging during development
      this.logToConsole(level, options.message, {
        correlationId,
        requestId,
        metadata: options.metadata,
      });
      
    } catch (error) {
      // Fallback to console if logging fails
      console.error('Logging error:', error);
      console.error('Failed log entry:', { level, ...options });
    }
  }
  
  // Log to console (for development)
  private logToConsole(
    level: string, 
    message: string, 
    context?: Record<string, any>
  ): void {
    const timestamp = new Date().toISOString();
    let consoleMethod: 'log' | 'info' | 'warn' | 'error';
    
    switch (level) {
      case 'debug':
        consoleMethod = 'log';
        break;
      case 'info':
        consoleMethod = 'info';
        break;
      case 'warn':
        consoleMethod = 'warn';
        break;
      case 'error':
      case 'critical':
        consoleMethod = 'error';
        break;
      default:
        consoleMethod = 'log';
    }
    
    console[consoleMethod](
      `[${timestamp}] [${level.toUpperCase()}]${context?.correlationId ? ` [${context.correlationId}]` : ''} ${message}`,
      context ? { ...context } : ''
    );
  }
  
  // Public logging methods for different levels
  public async debug(options: Omit<LogOptions, 'level'>): Promise<void> {
    return this.logWithLevel('debug', options);
  }
  
  public async info(options: Omit<LogOptions, 'level'>): Promise<void> {
    return this.logWithLevel('info', options);
  }
  
  public async warn(options: Omit<LogOptions, 'level'>): Promise<void> {
    return this.logWithLevel('warn', options);
  }
  
  public async error(options: Omit<LogOptions, 'level'>): Promise<void> {
    return this.logWithLevel('error', options);
  }
  
  public async critical(options: Omit<LogOptions, 'level'>): Promise<void> {
    return this.logWithLevel('critical', options);
  }
  
  // Log API integration calls
  public async apiIntegration(options: {
    apiName: 'twilio' | 'didit' | 'plaid' | 'thanksroger';
    endpoint: string;
    requestData?: any;
    responseData?: any;
    statusCode?: number;
    duration?: number;
    error?: Error;
    metadata?: Record<string, any>;
    userId?: number;
    req?: Request;
  }): Promise<void> {
    const {
      apiName,
      endpoint,
      requestData,
      responseData,
      statusCode,
      duration,
      error,
      metadata,
      userId,
      req,
    } = options;
    
    const isError = !!error || (statusCode && statusCode >= 400);
    const level = isError ? 'error' : 'info';
    
    const message = error
      ? `${apiName.toUpperCase()} API call to ${endpoint} failed: ${error.message}`
      : `${apiName.toUpperCase()} API call to ${endpoint} completed with status ${statusCode}`;
    
    await this.logWithLevel(level as any, {
      category: 'api',
      message,
      userId,
      source: apiName as any,
      metadata: {
        ...metadata,
        endpoint,
        requestData,
        responseData: isError ? undefined : responseData,
        error: error ? { message: error.message, stack: error.stack } : undefined,
      },
      statusCode,
      duration,
      tags: [apiName, endpoint, isError ? 'error' : 'success'],
      req,
    });
  }
  
  // Log contract-related events
  public async contractEvent(options: {
    action: 'created' | 'updated' | 'signed' | 'completed' | 'cancelled';
    contractId: number;
    contractNumber: string;
    userId?: number;
    merchantId?: number;
    customerId?: number;
    metadata?: Record<string, any>;
    req?: Request;
  }): Promise<void> {
    const {
      action,
      contractId,
      contractNumber,
      userId,
      merchantId,
      customerId,
      metadata,
      req,
    } = options;
    
    await this.info({
      category: 'contract',
      message: `Contract ${contractNumber} ${action}`,
      userId,
      metadata: {
        ...metadata,
        contractId,
        contractNumber,
        merchantId,
        customerId,
      },
      tags: ['contract', action],
      req,
    });
  }
  
  // Log security-related events
  public async security(options: {
    action: 'login' | 'logout' | 'failed_login' | 'password_change' | 'permission_denied';
    userId?: number;
    message: string;
    metadata?: Record<string, any>;
    req?: Request;
  }): Promise<void> {
    const { action, userId, message, metadata, req } = options;
    
    const level = ['failed_login', 'permission_denied'].includes(action) ? 'warn' : 'info';
    
    await this.logWithLevel(level as any, {
      category: 'security',
      message,
      userId,
      metadata: {
        ...metadata,
        action,
      },
      tags: ['security', action],
      req,
    });
  }
  
  // Log payment-related events
  public async payment(options: {
    action: 'payment_created' | 'payment_processed' | 'payment_failed';
    amount: number;
    contractId: number;
    contractNumber: string;
    userId?: number;
    metadata?: Record<string, any>;
    error?: Error;
    req?: Request;
  }): Promise<void> {
    const {
      action,
      amount,
      contractId,
      contractNumber,
      userId,
      metadata,
      error,
      req,
    } = options;
    
    const level = action === 'payment_failed' ? 'error' : 'info';
    const message = error
      ? `Payment for contract ${contractNumber} failed: ${error.message}`
      : `Payment of $${amount.toFixed(2)} for contract ${contractNumber} ${action.replace('payment_', '')}`;
    
    await this.logWithLevel(level as any, {
      category: 'payment',
      message,
      userId,
      metadata: {
        ...metadata,
        action,
        amount,
        contractId,
        contractNumber,
        error: error ? { message: error.message, stack: error.stack } : undefined,
      },
      tags: ['payment', action],
      req,
    });
  }
}

// Create and export a singleton instance
export const logger = new Logger();

// Express middleware for request logging
export const requestLogger = (req: Request, res: any, next: any) => {
  // Generate a correlation ID for this request
  const correlationId = generateCorrelationId();
  setCorrelationId(correlationId);
  
  // Set correlation ID in response headers
  res.setHeader('X-Correlation-ID', correlationId);
  
  // Record request start time
  const startTime = Date.now();
  
  // Capture the original end method
  const originalEnd = res.end;
  
  // Override the end method
  res.end = function(...args: any[]) {
    // Calculate request duration
    const duration = Date.now() - startTime;
    
    // Log the request
    logger.info({
      category: 'api',
      message: `${req.method} ${req.originalUrl} ${res.statusCode}`,
      correlationId,
      duration,
      statusCode: res.statusCode,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string,
      metadata: {
        method: req.method,
        path: req.originalUrl,
        params: req.params,
        query: req.query,
        // Don't log sensitive body data like passwords
        body: req.method !== 'GET' ? sanitizeRequestBody(req.body) : undefined,
        responseTime: `${duration}ms`,
      },
      tags: ['http', req.method, `status-${res.statusCode}`],
    });
    
    // Call the original end method
    originalEnd.apply(res, args);
    
    // Reset correlation ID after request is complete
    resetCorrelationId();
  };
  
  next();
};

// Sanitize sensitive data from request body
function sanitizeRequestBody(body: any): any {
  if (!body) return body;
  
  const sensitiveFields = ['password', 'token', 'secret', 'credential', 'credit_card', 'ssn'];
  const sanitized = { ...body };
  
  for (const key in sanitized) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeRequestBody(sanitized[key]);
    }
  }
  
  return sanitized;
}