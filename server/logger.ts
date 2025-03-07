import { storage } from './storage';

interface LogParams {
  message: string;
  category?: string;
  source?: string;
  metadata?: any;
  userId?: number;
  level?: 'debug' | 'info' | 'warn' | 'error' | 'critical';
}

export const logger = {
  debug: async (params: LogParams) => {
    console.debug(`[DEBUG] ${params.message}`, params.metadata || '');
    try {
      await storage.createLog({
        level: 'debug',
        category: params.category || 'system',
        source: params.source || 'internal',
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
        category: params.category || 'system',
        source: params.source || 'internal',
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
        category: params.category || 'system',
        source: params.source || 'internal',
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
        category: params.category || 'system',
        source: params.source || 'internal',
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
        category: params.category || 'system',
        source: params.source || 'internal',
        message: params.message,
        userId: params.userId,
        metadata: params.metadata ? JSON.stringify(params.metadata) : undefined,
      });
    } catch (err) {
      console.error('Failed to write critical log to database:', err);
    }
  },
};