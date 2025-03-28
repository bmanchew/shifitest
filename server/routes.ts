import express, { type Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { logger } from "./services/logger";
import { requestLoggerMiddleware, errorLoggerMiddleware } from "./middleware/requestLogger";
import fs from 'fs';

// Import feature-specific routers
import authRouter from "./routes/auth";
import userRouter from "./routes/users";
import communicationsRouter from "./routes/communications";
import adminRouter from "./routes/admin";
import { reportsRouter } from "./routes/admin/reports";
import { adminReportsRouter } from "./routes/adminReports";
import contractsRouter from "./routes/contracts";
import underwritingRouter from "./routes/underwriting";
import merchantRouter from "./routes/merchant";
import merchantDashboardRouter from "./routes/merchant-dashboard";
import notificationRouter from "./routes/notification";
import merchantFundingRouter from "./routes/merchant-funding";
import customerRouter from "./routes/customers";
import paymentRouter from "./routes/payments";
import healthRouter from "./routes/health";
import blockchainRouter from "./routes/blockchain";
import salesRepRouter from "./routes/salesRep";
import plaidRouter from "./routes/plaid.routes";

/**
 * Register all application routes with the Express app
 */
export async function registerRoutes(app: Express): Promise<Server> {
  // Create the main API router
  const apiRouter = express.Router();
  
  // Apply global middleware to all API routes
  apiRouter.use(requestLoggerMiddleware);
  
  // Log all API requests for debugging
  apiRouter.use((req: Request, res: Response, next: NextFunction) => {
    logger.info({
      message: `API Request: ${req.method} ${req.originalUrl}`,
      category: "api",
      source: "router",
      metadata: {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('user-agent')
      }
    });
    next();
  });
  
  // API Health check endpoint
  apiRouter.get("/", (req: Request, res: Response) => {
    res.status(200).json({
      status: "healthy",
      message: "ShiFi API is running",
      timestamp: new Date().toISOString()
    });
  });
  
  // ===== Register all feature-specific routers =====
  
  // Core functionality routers - mount these first
  apiRouter.use("/auth", authRouter);           // Authentication routes
  apiRouter.use("/users", userRouter);          // User management routes
  
  // Domain-specific feature routers
  apiRouter.use("/plaid", plaidRouter);         // Plaid integration
  apiRouter.use("/admin/reports", reportsRouter);      // Admin reports
  apiRouter.use("/admin/analysis", adminReportsRouter); // Admin analytics
  apiRouter.use("/admin", adminRouter);                // Main admin area
  apiRouter.use("/underwriting", underwritingRouter);  // Underwriting management
  apiRouter.use("/contracts", contractsRouter);        // Contract management
  apiRouter.use("/customers", customerRouter);         // Customer management
  apiRouter.use("/merchants", merchantRouter);         // Merchant management
  apiRouter.use("/merchant-dashboard", merchantDashboardRouter); // Merchant dashboard
  apiRouter.use("/merchant-funding", merchantFundingRouter);    // Merchant funding
  apiRouter.use("/notifications", notificationRouter); // Notifications
  apiRouter.use("/payments", paymentRouter);           // Payment processing
  apiRouter.use("/health", healthRouter);              // Health monitoring
  apiRouter.use("/blockchain", blockchainRouter);      // Blockchain functionality
  apiRouter.use("/sales-reps", salesRepRouter);        // Sales rep management
  
  // Communication endpoints with aliases
  apiRouter.use("/communications", communicationsRouter);
  apiRouter.use("/conversations", communicationsRouter);
  apiRouter.use("/support-tickets", communicationsRouter);
  
  // API 404 handler - must be registered after all valid routes
  apiRouter.use((req: Request, res: Response) => {
    // Log the 404 with detailed routing information
    logger.warn({
      message: `API 404: ${req.method} ${req.originalUrl} not found`,
      category: "api",
      source: "router",
      metadata: {
        method: req.method,
        originalUrl: req.originalUrl,
        baseUrl: req.baseUrl,
        path: req.path,
        params: req.params,
        query: req.query
      }
    });
    
    // Return user-friendly error
    res.status(404).json({
      success: false,
      message: "API endpoint not found",
      path: req.originalUrl,
      method: req.method
    });
  });
  
  // Apply error handling middleware
  apiRouter.use(errorLoggerMiddleware);
  
  // Mount the API router at /api
  app.use("/api", apiRouter);
  
  // Configure proper MIME types for Express static middleware
  const staticOptions = {
    setHeaders: (res: Response, path: string) => {
      // Set appropriate MIME types for JavaScript modules and other assets
      if (path.endsWith('.js') || path.endsWith('.mjs')) {
        res.set('Content-Type', 'application/javascript');
      } else if (path.endsWith('.css')) {
        res.set('Content-Type', 'text/css');
      }
      
      // Log the file being served
      logger.info({
        message: `Serving static file: ${path}`,
        category: "http",
        source: "static"
      });
    },
    // Make sure the files are properly cached - improve performance
    cacheControl: true,
    etag: true,
    lastModified: true,
    // Support index.html in directories for SPA routing
    index: 'index.html'
  };
  
  // Serve static files from the client/dist directory
  app.use(express.static('./client/dist', staticOptions));

  // Explicit root path handler - ensures that the root URL works correctly
  app.get('/', (req: Request, res: Response) => {
    logger.info({
      message: `Handling root path request`,
      category: "http",
      source: "router"
    });
    
    // Serve index.html for the root path
    res.set('Content-Type', 'text/html');
    res.status(200).sendFile('index.html', { root: './client/dist' });
  });
  
  // Handle client-side routing - this comes after static file middleware and root handler
  // Sends index.html for all non-API/non-asset requests to let the SPA router handle it
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    // Skip API routes and static asset requests
    if (req.path.startsWith('/api/') || req.path.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff|woff2|ttf|eot|map|json)$/)) {
      return next();
    }
    
    // Log the SPA route being handled
    logger.info({
      message: `Handling SPA route: ${req.method} ${req.originalUrl}`,
      category: "http",
      source: "router"
    });
    
    // Serve the index.html for SPA routes like login, dashboard, etc.
    res.set('Content-Type', 'text/html');
    res.status(200).sendFile('index.html', { root: './client/dist' });
  });
  
  // API 404 handler - catches any unhandled API routes
  app.use('/api/*', (req: Request, res: Response) => {
    logger.warn({
      message: `API 404: ${req.method} ${req.originalUrl} not found`,
      category: "api",
      source: "router",
      metadata: {
        originalUrl: req.originalUrl,
        method: req.method
      }
    });
    
    res.status(404).json({
      success: false,
      message: "API endpoint not found",
      path: req.originalUrl
    });
  });
  
  // Global 404 handler - any routes not caught by previous handlers
  app.use((req: Request, res: Response) => {
    logger.warn({
      message: `404 Not Found: ${req.method} ${req.originalUrl}`,
      category: "http",
      source: "router"
    });
    
    // Fall back to serving index.html for any remaining routes
    res.set('Content-Type', 'text/html');
    res.status(200).sendFile('index.html', { root: './client/dist' });
  });
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  return httpServer;
}