
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { logger, requestLogger } from "./services/logger";
import { storage } from "./storage";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add the request logger middleware for enhanced logging
app.use(requestLogger);

// Keep basic console logging for development
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Create a server startup function that avoids multiple instances
async function startServer() {
  // Use a more robust singleton check with process-wide lock file approach
  const lockKey = 'server_instance_running';
  
  // Check if another instance is already running
  if ((global as any)[lockKey]) {
    logger.warn({
      message: "Server startup attempted but server is already running",
      category: "system",
      metadata: { alreadyRunning: true }
    });
    return;
  }
  
  // Set global lock
  (global as any)[lockKey] = true;
  
  // Set up cleanup to release lock on process termination
  const cleanup = () => {
    (global as any)[lockKey] = false;
    process.exit(0);
  };
  
  // Handle termination signals
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('uncaughtException', (err) => {
    logger.error({
      message: `Uncaught exception: ${err.message}`,
      category: 'system',
      metadata: { 
        error: err.message,
        stack: err.stack 
      }
    });
    cleanup();
  });

  try {
    // Seed the database with initial data if needed
    try {
      // Check if database needs seeding and seed it
      if ('seedInitialData' in storage) {
        await (storage as any).seedInitialData();
      }
      
      // Run any pending migrations
      try {
        // Import runMigrations function using dynamic import
        const { runMigrations } = await import('./migrations/index');
        await runMigrations();
        logger.info({
          message: 'Database migrations completed during startup',
          category: 'system',
        });
      } catch (migrationError) {
        logger.warn({
          message: `Could not run migrations: ${migrationError instanceof Error ? migrationError.message : String(migrationError)}`,
          category: 'system',
          metadata: { error: String(migrationError) }
        });
      }
    } catch (error) {
      console.error("Error initializing database:", error);
      logger.error({
        message: 'Error initializing database',
        category: 'system',
        metadata: { 
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined 
        }
      });
    }

    const server = await registerRoutes(app);

    app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      // Log the error with our enhanced logger
      logger.error({
        message: `Error: ${message}`,
        req,
        statusCode: status,
        metadata: {
          stack: err.stack,
          error: err instanceof Error ? err.message : String(err)
        }
      });

      res.status(status).json({ message });
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Increase max listeners to prevent warnings
    server.setMaxListeners(20);

    // Single instance of port selection logic with better error handling
    let currentPort = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;
    let maxPortAttempts = 10; // Limit port attempts to prevent infinite loops
    
    const startOnAvailablePort = () => {
      return new Promise<void>((resolve, reject) => {
        if (maxPortAttempts <= 0) {
          return reject(new Error('Could not find an available port after multiple attempts'));
        }
        
        if (server.listening) {
          logger.warn({
            message: `Server is already listening, not starting again`,
            category: 'system',
            metadata: { port: currentPort }
          });
          return resolve();
        }
        
        const httpServer = server.listen({
          port: currentPort,
          host: "0.0.0.0",
          reusePort: false,
        }, () => {
          const serverAddress = httpServer.address();
          const serverPort = typeof serverAddress === 'object' && serverAddress ? serverAddress.port : currentPort;
          log(`Server listening on http://0.0.0.0:${serverPort}`);
          logger.info({
            message: `ShiFi server started on port ${serverPort}`,
            category: 'system',
            metadata: {
              environment: app.get('env'),
              nodeVersion: process.version,
              address: '0.0.0.0',
              port: serverPort
            },
            tags: ['startup', 'server']
          });
          resolve();
        });
        
        httpServer.on('error', (err: Error & { code?: string }) => {
          if (err.code === 'EADDRINUSE' && !process.env.PORT) {
            log(`Port ${currentPort} is in use, trying ${currentPort + 1}`);
            currentPort++;
            maxPortAttempts--;
            httpServer.close(() => {
              startOnAvailablePort().then(resolve).catch(reject);
            });
          } else {
            logger.error({
              message: `Error starting server: ${err.message}`,
              category: 'system',
              metadata: { error: err.message }
            });
            reject(err);
          }
        });
      });
    };
    
    // Start the server on an available port
    await startOnAvailablePort();
    
  } catch (error) {
    logger.error({
      message: `Critical error starting server: ${error instanceof Error ? error.message : String(error)}`,
      category: 'system',
      metadata: { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined 
      }
    });
    // Release lock to allow for restart attempts
    (global as any)[lockKey] = false;
  }
}

// Only call startServer once
startServer().catch(err => {
  console.error('Failed to start server:', err);
});
