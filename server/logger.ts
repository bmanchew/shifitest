import { storage } from "./storage";

export enum LogCategory {
  Security = "security",
  Payment = "payment",
  System = "system",
  User = "user",
  API = "api",
  Contract = "contract",
}

export enum LogSource {
  Internal = "internal",
  Twilio = "twilio",
  Didit = "didit",
  Plaid = "plaid",
  ThanksRoger = "thanksroger",
  PreFi = "prefi",
}

interface LogParams {
  message: string;
  metadata?: Record<string, any>;
  category?: LogCategory;
  source?: LogSource;
  userId?: number;
  level?: 'debug' | 'info' | 'warn' | 'error' | 'critical';
}

export const logger = {
  debug: async (params: LogParams) => {
    console.debug(`[DEBUG] ${params.message}`, params.metadata || '');
    try {
      await storage.createLog({
        level: 'debug',
        category: params.category || LogCategory.System,
        source: params.source || LogSource.Internal,
        message: params.message,
        userId: params.userId,
        metadata: params.metadata ? JSON.stringify(params.metadata) : undefined,
      });
    } catch (err) {
      console.error('Failed to write debug log to database:', err);
    }
  },

  info: async (params: LogParams) => {
    console.info(`[INFO] ${params.message}`, params.metadata || '');
    try {
      await storage.createLog({
        level: 'info',
        category: params.category || LogCategory.System,
        source: params.source || LogSource.Internal,
        message: params.message,
        userId: params.userId,
        metadata: params.metadata ? JSON.stringify(params.metadata) : undefined,
      });
    } catch (err) {
      console.error('Failed to write info log to database:', err);
    }
  },

  warn: async (params: LogParams) => {
    console.warn(`[WARN] ${params.message}`, params.metadata || '');
    try {
      await storage.createLog({
        level: 'warn',
        category: params.category || LogCategory.System,
        source: params.source || LogSource.Internal,
        message: params.message,
        userId: params.userId,
        metadata: params.metadata ? JSON.stringify(params.metadata) : undefined,
      });
    } catch (err) {
      console.error('Failed to write warn log to database:', err);
    }
  },

  error: async (params: LogParams) => {
    console.error(`[ERROR] ${params.message}`, params.metadata || '');
    try {
      await storage.createLog({
        level: 'error',
        category: params.category || LogCategory.System,
        source: params.source || LogSource.Internal,
        message: params.message,
        userId: params.userId,
        metadata: params.metadata ? JSON.stringify(params.metadata) : undefined,
      });
    } catch (err) {
      console.error('Failed to write error log to database:', err);
    }
  },

  critical: async (params: LogParams) => {
    console.error(`[CRITICAL] ${params.message}`, params.metadata || '');
    try {
      await storage.createLog({
        level: 'critical',
        category: params.category || LogCategory.System,
        source: params.source || LogSource.Internal,
        message: params.message,
        userId: params.userId,
        metadata: params.metadata ? JSON.stringify(params.metadata) : undefined,
      });
    } catch (err) {
      console.error('Failed to write critical log to database:', err);
    }
  },
};