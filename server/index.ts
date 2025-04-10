/**
 * Server initialization file
 * This file should only contain the logic to initialize and start the server
 */
import { createApp } from './app';
import { createServer } from 'http';
import { logger } from './services/logger';
import { storage } from './storage';
import { openaiRealtimeWebSocketService } from './services/openaiRealtimeWebSocket.fixed';

// Environment constants
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

/**
 * Main server startup function
 * This function initializes the Express app and starts the HTTP server
 */
async function startServer() {
  try {
    logger.info({
      message: 'Starting server initialization',
      category: 'system',
      source: 'internal'
    });

    // Seed the database with initial data if needed
    try {
      // Check if database needs seeding
      if ('seedInitialData' in storage) {
        await (storage as any).seedInitialData();
        logger.info({
          message: 'Database seeded with initial data',
          category: 'system',
          source: 'internal'
        });
      }

      // Run any pending migrations
      try {
        const { runMigrations } = await import('./migrations/index');
        await runMigrations();
        logger.info({
          message: 'Database migrations completed during startup',
          category: 'system',
          source: 'internal'
        });
      } catch (migrationError) {
        logger.warn({
          message: `Could not run migrations: ${migrationError instanceof Error ? migrationError.message : String(migrationError)}`,
          category: 'system',
          source: 'internal',
          metadata: { error: String(migrationError) }
        });
      }
    } catch (dbError) {
      logger.error({
        message: 'Error initializing database',
        category: 'system',
        source: 'internal',
        metadata: {
          error: dbError instanceof Error ? dbError.message : String(dbError),
          stack: dbError instanceof Error ? dbError.stack : undefined
        }
      });
    }

    // Create Express app
    const app = createApp();
    
    // Create HTTP server
    const server = createServer(app);
    
    // Initialize WebSocket service
    try {
      openaiRealtimeWebSocketService.initialize(server);
      logger.info({
        message: 'OpenAI Realtime WebSocket service initialized successfully',
        category: 'system',
        source: 'openai'
      });
    } catch (wsError) {
      logger.error({
        message: `Error initializing OpenAI Realtime WebSocket service: ${wsError instanceof Error ? wsError.message : String(wsError)}`,
        category: 'system',
        source: 'openai',
        metadata: {
          error: wsError instanceof Error ? wsError.message : String(wsError),
          stack: wsError instanceof Error ? wsError.stack : undefined
        }
      });
    }

    // Start the server
    server.listen(PORT, HOST, () => {
      logger.info({
        message: `Server running at http://${HOST}:${PORT}`,
        category: 'system',
        source: 'internal',
        metadata: {
          port: PORT,
          host: HOST,
          node_env: process.env.NODE_ENV || 'development'
        }
      });
    });

    // Handle shutdown gracefully
    const handleShutdown = () => {
      logger.info({
        message: 'Shutting down server gracefully',
        category: 'system',
        source: 'internal'
      });
      
      server.close(() => {
        logger.info({
          message: 'Server shutdown complete',
          category: 'system',
          source: 'internal'
        });
        process.exit(0);
      });
      
      // Force shutdown after 10 seconds if server doesn't close gracefully
      setTimeout(() => {
        logger.error({
          message: 'Forced server shutdown after timeout',
          category: 'system',
          source: 'internal'
        });
        process.exit(1);
      }, 10000);
    };

    // Setup signal handlers
    process.on('SIGTERM', handleShutdown);
    process.on('SIGINT', handleShutdown);
    process.on('uncaughtException', (error) => {
      logger.error({
        message: `Uncaught exception: ${error.message}`,
        category: 'system',
        source: 'internal',
        metadata: {
          error: error.message,
          stack: error.stack
        }
      });
      handleShutdown();
    });
    
    return server;
  } catch (error) {
    logger.error({
      message: `Failed to start server: ${error instanceof Error ? error.message : String(error)}`,
      category: 'system',
      source: 'internal',
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    throw error;
  }
}

// Start the server
startServer().catch(error => {
  console.error('Fatal error starting server:', error);
  process.exit(1);
});