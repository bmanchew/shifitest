/**
 * Logging utility for standardized logging across the application
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';
export type LogCategory = 'api' | 'auth' | 'database' | 'email' | 'integration' | 'security' | 'system' | 'payment' | 'notification';
export type LogSource = 'internal' | 'client' | 'webhook' | 'zapier' | 'plaid' | 'twilio';

interface BaseLog {
  message: string;
  metadata?: Record<string, any>;
  category?: LogCategory;
  source?: LogSource;
  tags?: string[];
  ipAddress?: string;
  userAgent?: string;
  userId?: number;
  duration?: number; // for measuring performance (in ms)
  statusCode?: number; // for API responses
}

interface DebugLog extends BaseLog {
  level: 'debug';
}

interface InfoLog extends BaseLog {
  level: 'info';
}

interface WarnLog extends BaseLog {
  level: 'warn';
}

interface ErrorLog extends BaseLog {
  level: 'error';
}

interface CriticalLog extends BaseLog {
  level: 'critical';
}

type LogEntry = DebugLog | InfoLog | WarnLog | ErrorLog | CriticalLog;

/**
 * Logger class for standardized logging throughout the application
 */
class Logger {
  constructor() {
    // Any initialization can go here if needed
  }

  /**
   * Log to the console formatted with level, timestamp, etc.
   */
  private logToConsole(entry: LogEntry): void {
    const timestamp = new Date().toISOString();
    const levelColor = this.getLevelColor(entry.level);
    const resetColor = '\x1b[0m';
    
    // Format: [LEVEL] [TIMESTAMP] [CATEGORY] [SOURCE] Message
    let logString = `${levelColor}[${entry.level.toUpperCase()}]${resetColor}`;
    logString += ` [${timestamp}]`;
    
    if (entry.category) {
      logString += ` [${entry.category}]`;
    }
    
    if (entry.source) {
      logString += ` [${entry.source}]`;
    }
    
    logString += `: ${entry.message}`;
    
    // Add metadata if present
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      logString += `\n${JSON.stringify(entry.metadata, null, 2)}`;
    }
    
    // Log based on level
    switch (entry.level) {
      case 'debug':
        console.debug(logString);
        break;
      case 'info':
        console.info(logString);
        break;
      case 'warn':
        console.warn(logString);
        break;
      case 'error':
      case 'critical':
        console.error(logString);
        break;
      default:
        console.log(logString);
    }
  }
  
  /**
   * Get color code for console output based on log level
   */
  private getLevelColor(level: LogLevel): string {
    switch (level) {
      case 'debug':
        return '\x1b[36m'; // Cyan
      case 'info':
        return '\x1b[32m'; // Green
      case 'warn':
        return '\x1b[33m'; // Yellow
      case 'error':
        return '\x1b[31m'; // Red
      case 'critical':
        return '\x1b[35m'; // Purple/Magenta
      default:
        return '\x1b[0m'; // Reset
    }
  }

  /**
   * Main log method used by level-specific methods
   */
  private async log(entry: LogEntry): Promise<void> {
    // Log to console for development environment
    this.logToConsole(entry);
    
    // In the future, we could add database logging or external logging services here
  }

  /**
   * Log a debug message
   */
  async debug(entry: BaseLog): Promise<void> {
    await this.log({ ...entry, level: 'debug' });
  }

  /**
   * Log an info message
   */
  async info(entry: BaseLog): Promise<void> {
    await this.log({ ...entry, level: 'info' });
  }

  /**
   * Log a warning message
   */
  async warn(entry: BaseLog): Promise<void> {
    await this.log({ ...entry, level: 'warn' });
  }

  /**
   * Log an error message
   */
  async error(entry: BaseLog): Promise<void> {
    await this.log({ ...entry, level: 'error' });
  }

  /**
   * Log a critical error message
   */
  async critical(entry: BaseLog): Promise<void> {
    await this.log({ ...entry, level: 'critical' });
  }
}

// Export a singleton instance
export const logger = new Logger();