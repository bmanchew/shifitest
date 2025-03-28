import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { debugLoginRoutes, debugRoutePaths } from "./middleware/debug-logger";
import { requestLoggerMiddleware, errorLoggerMiddleware } from "./middleware/requestLogger";
import { logger } from "./services/logger";
import authRouter from "./routes/auth";
import usersRouter from "./routes/users";
import mainRouter from "./routes/main";

/**
 * This patch adds detailed debug logging for auth routes
 * to help diagnose the 404 error on login
 */
export async function registerRoutes(app: Express): Promise<Server> {
  // Create main API router
  const apiRouter = express.Router();
  
  // Add advanced request logging and debugging
  apiRouter.use(requestLoggerMiddleware);
  apiRouter.use(debugLoginRoutes);
  
  // Debug all routes to help diagnose path matching issues
  apiRouter.use(debugRoutePaths('apiRouter'));
  
  // Add explicit auth routes at the top level to ensure they're found
  // Add debug logging before and after this router
  apiRouter.use('/auth', debugRoutePaths('auth-before'), authRouter, debugRoutePaths('auth-after'));
  apiRouter.use('/users', usersRouter);
  
  // Mount main router which contains all other feature routers
  apiRouter.use(mainRouter);
  
  // Add global 404 handler for API routes
  apiRouter.use((req: Request, res: Response) => {
    // Log the 404 with detailed routing information
    logger.warn({
      message: `API 404 NOT FOUND: ${req.method} ${req.originalUrl}`,
      category: 'api',
      source: 'debug',
      metadata: {
        method: req.method,
        originalUrl: req.originalUrl,
        baseUrl: req.baseUrl,
        path: req.path,
        ip: req.ip,
        params: req.params,
        query: req.query,
        headers: {
          host: req.headers.host,
          referer: req.headers.referer,
          'user-agent': req.headers['user-agent'],
        }
      }
    });
    
    res.status(404).json({
      success: false,
      message: `Route not found: ${req.method} ${req.originalUrl}`,
      timestamp: new Date().toISOString()
    });
  });
  
  // Add error logging middleware
  apiRouter.use(errorLoggerMiddleware);
  
  // Mount the API router
  app.use("/api", apiRouter);
  
  // Add global 404 handler as fallback
  app.use((req: Request, res: Response) => {
    logger.warn({
      message: `Global 404: ${req.method} ${req.originalUrl}`,
      category: 'http',
      source: 'router'
    });
    
    // For API routes, return JSON
    if (req.path.startsWith('/api')) {
      return res.status(404).json({
        success: false,
        message: 'API endpoint not found'
      });
    }
    
    // For other routes (client-side), let the frontend handle it
    res.status(404).send('Not Found');
  });
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  return httpServer;
}