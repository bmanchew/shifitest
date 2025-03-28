import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { logger } from "./services/logger";
import { requestLoggerMiddleware, errorLoggerMiddleware } from "./middleware/requestLogger";

/**
 * This adds detailed debugging for auth routes to help diagnose
 * the 404 error on login page
 */
export async function registerRoutes(app: Express): Promise<Server> {
  const apiRouter = express.Router();
  
  // Add advanced request logging for all API routes
  apiRouter.use((req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    
    // For all login-related routes, add extra debug info
    if (req.originalUrl.includes('/auth/login')) {
      logger.info({
        message: `DEBUG LOGIN: ${req.method} ${req.originalUrl}`,
        category: 'auth',
        source: 'debug',
        metadata: {
          requestId,
          method: req.method,
          url: req.originalUrl,
          baseUrl: req.baseUrl,
          path: req.path,
          headers: {
            'user-agent': req.headers['user-agent'],
            'content-type': req.headers['content-type'],
            referer: req.headers.referer,
          },
          query: req.query,
          body: req.method === 'POST' ? { ...req.body, password: '[REDACTED]' } : undefined
        }
      });
    }
    
    // For all routes, track the response
    const originalSend = res.send;
    res.send = function(body) {
      const responseTime = Date.now() - startTime;
      
      logger.info({
        message: `API ${req.method} ${req.originalUrl} - ${res.statusCode} (${responseTime}ms)`,
        category: 'api',
        source: 'router',
        metadata: {
          requestId,
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode,
          responseTime: `${responseTime}ms`
        }
      });
      
      return originalSend.call(this, body);
    };
    
    next();
  });
  
  /***** ORIGINAL ROUTES.TS CONTENT BELOW THIS LINE *****/
  
  // Health check endpoint
  apiRouter.get("/", (req: Request, res: Response) => {
    res.status(200).json({
      status: "healthy",
      message: "ShiFi API is running"
    });
  });
  
  // Auth routes with expanded logging
  apiRouter.post("/auth/login", async (req: Request, res: Response) => {
    logger.info({
      message: `Processing login request from ${req.ip}`,
      category: 'auth',
      source: 'login-handler'
    });
    
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        logger.warn({
          message: 'Login attempt missing email or password',
          category: 'auth',
          source: 'login-handler',
          metadata: { hasEmail: !!email, hasPassword: !!password }
        });
        
        return res.status(400).json({ 
          success: false, 
          message: "Email and password are required" 
        });
      }
      
      // Continue with existing login logic...
      // Existing implementations remain the same
    } catch (error) {
      logger.error({
        message: `Login error: ${error instanceof Error ? error.message : String(error)}`,
        category: "security",
        source: "internal",
        metadata: {
          errorStack: error instanceof Error ? error.stack : String(error)
        }
      });
      
      res.status(500).json({ 
        success: false, 
        message: "Internal server error" 
      });
    }
  });
  
  // Also add a GET handler for the login endpoint to help diagnose the 404
  apiRouter.get("/auth/login", (req: Request, res: Response) => {
    logger.info({
      message: `GET request to /auth/login - This should be POST only`,
      category: 'auth',
      source: 'debug',
      metadata: {
        ip: req.ip,
        headers: {
          'user-agent': req.headers['user-agent'],
          referer: req.headers.referer
        }
      }
    });
    
    res.status(405).json({
      success: false,
      message: "Login requires a POST request with email and password",
      timestamp: new Date().toISOString()
    });
  });
  
  // ***** ALL OTHER ROUTES FROM ORIGINAL ROUTES.TS WOULD BE HERE *****
  
  // Add a catch-all 404 handler for API routes
  apiRouter.use((req: Request, res: Response) => {
    logger.warn({
      message: `API route not found: ${req.method} ${req.originalUrl}`,
      category: 'api',
      source: 'router',
      metadata: {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip
      }
    });
    
    res.status(404).json({
      success: false,
      message: `API endpoint not found: ${req.method} ${req.originalUrl}`
    });
  });
  
  // Apply error logging middleware
  apiRouter.use(errorLoggerMiddleware);
  
  // Mount the API router
  app.use("/api", apiRouter);
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  return httpServer;
}