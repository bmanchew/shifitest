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

(async () => {
  // Seed the database with initial data if needed
  try {
    // Check if database needs seeding and seed it
    if ('seedInitialData' in storage) {
      await (storage as any).seedInitialData();
    }
  } catch (error) {
    console.error("Error seeding database:", error);
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
        error: err
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

  // Try to serve the app on port 5000 first, but fall back to other ports if needed
  const startServer = (port = 5000, maxAttempts = 3, attempt = 1) => {
    const serverInstance = server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`serving on port ${port}`);
      logger.info({
        message: `ShiFi server started on port ${port}`,
        category: 'system',
        metadata: {
          environment: app.get('env'),
          nodeVersion: process.version
        },
        tags: ['startup', 'server']
      });
    });

    serverInstance.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE' && attempt < maxAttempts) {
        log(`Port ${port} is already in use, trying port ${port + 1}...`);
        serverInstance.close();
        startServer(port + 1, maxAttempts, attempt + 1);
      } else {
        console.error(`Failed to start server: ${err.message}`);
        process.exit(1);
      }
    });
  };

  startServer();
})();
