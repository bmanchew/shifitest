import express, { type Express, Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { csrfProtectionWithExclusions, csrfTokenHandler, csrfErrorHandler } from "./middleware/csrfMiddleware";
import jwt from "jsonwebtoken";
import { errorHandler } from "./services/errorHandler";
import { logger, requestLogger } from "./services/logger";
import { storage } from "./storage";
import { setupVite, serveStatic } from "./vite";
import { registerRoutes } from "./routes/index";

/**
 * Function to configure and initialize the Express application
 * This centralizes all app setup code in one place
 */
export function createApp(): Express {
  // Create Express app
  const app = express();
  
  // Enable trust proxy to work with Replit and properly handle X-Forwarded-For headers
  app.set('trust proxy', true);
  
  // Common middleware
  app.use(express.json());
  app.use(cookieParser(process.env.COOKIE_SECRET || process.env.JWT_SECRET));
  
  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://js.stripe.com", "https://cdn.plaid.com"],
        connectSrc: ["'self'", "https://api.stripe.com", "https://*.plaid.com", "wss://*.openai.com", "https://*.openai.com"],
        frameSrc: ["'self'", "https://js.stripe.com", "https://cdn.plaid.com", "https://connect.stripe.com"],
        imgSrc: ["'self'", "data:", "https://*"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: []
      }
    },
    crossOriginEmbedderPolicy: false, // To allow Plaid Link to work properly
    crossOriginResourcePolicy: { policy: "cross-origin" } // Allow resources from different origins
  }));
  
  // CORS middleware
  app.use((req, res, next) => {
    const allowedOrigins = [
      'https://1825e65f-101b-467b-bee7-c29733668cc0.replit.dev',
      'https://1825e65f-101b-467b-bee7-c29733668cc0-00-9psqa3aypt1d.janeway.replit.dev',
      'https://1825e65f-101b-467b-bee7-c29733668cc0-00-9psqa3aypt1d.janeway.replit.dev',
      'https://1825e65f-101b-467b-bee7-c29733668cc0-00-9psqa3aypt1d.janeway.replit.dev',
      'https://8dc3f57a-133b-45a5-ba2b-9e2b16042657-00-572nlsfm974b.janeway.replit.dev/api/plaid/webhook'
    ];
    
    const origin = req.headers.origin;
    console.log('Incoming request from origin:', origin);
    console.log('Allowed origins:', allowedOrigins.join(', '));
    
    if (origin) {
      if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      } else if (process.env.NODE_ENV === 'development') {
        // In development, allow any origin for easier testing
        res.setHeader('Access-Control-Allow-Origin', '*');
      }
    } else {
      // If no origin header, still allow access in development
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    next();
  });
  
  // Enhanced authentication middleware to extract user from JWT token
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get token from Authorization header or cookies
      const token = getTokenFromRequest(req);
      
      if (token) {
        try {
          // Verify the token with required JWT_SECRET (no fallback)
          if (!process.env.JWT_SECRET) {
            logger.error({
              message: "JWT_SECRET is not set in environment variables",
              category: "security",
              source: "internal"
            });
            throw new Error("JWT_SECRET is not configured");
          }
          
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          
          if (typeof decoded === 'object' && decoded.userId) {
            // Get user from database
            const user = await storage.getUser(decoded.userId);
            
            if (user) {
              // Attach user to request object
              req.user = user;
            }
          }
        } catch (tokenError) {
          // Don't block the request if token is invalid, just log the error
          if (!(tokenError instanceof jwt.TokenExpiredError)) {
            logger.warn({
              message: `JWT validation error: ${tokenError instanceof Error ? tokenError.message : String(tokenError)}`,
              category: "security",
              source: "internal",
              metadata: {
                path: req.path
              }
            });
          }
        }
      }
      
      // Continue even if no token is present or token is invalid
      next();
    } catch (error) {
      // Just log the error and continue - don't block requests if auth fails
      logger.warn({
        message: `Auth middleware error: ${error instanceof Error ? error.message : String(error)}`,
        category: "security",
        source: "internal",
        metadata: {
          path: req.path
        }
      });
      next();
    }
  });
  
  // Request logging middleware
  app.use(requestLogger);
  
  // CSRF protection for API routes
  app.use('/api', csrfProtectionWithExclusions);
  
  // Endpoint to get CSRF token
  app.get('/api/csrf-token', csrfTokenHandler);
  
  // Register all modular routes
  registerRoutes(app);
  
  // CSRF error handler
  app.use(csrfErrorHandler);
  
  // Global error handler
  app.use(errorHandler);
  
  // Set up Vite for development or static file serving for production
  setupVite(app);
  
  return app;
}

/**
 * Helper function to extract JWT token from request
 * Prioritizes secure HttpOnly cookies over Authorization header
 */
function getTokenFromRequest(req: Request): string | null {
  // First check for secure HttpOnly cookie (more secure)
  if (req.cookies && req.cookies.auth_token) {
    return req.cookies.auth_token;
  }

  // Legacy support for old cookie name
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  
  // Fallback to Authorization header (Bearer token) for backward compatibility
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  
  return null;
}