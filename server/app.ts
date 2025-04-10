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
import { apiProxyMiddleware } from "./middleware/api-proxy-middleware.js";
import { extractTokenFromRequest, verifyToken } from "./utils/tokens";

/**
 * Function to configure and initialize the Express application
 * This centralizes all app setup code in one place
 */
export function createApp(): Express {
  // Create Express app
  const app = express();
  
  // Enable trust proxy to work with Replit and properly handle X-Forwarded-For headers
  // Use the first IP in X-Forwarded-For as this is most likely to be the actual client IP
  app.set('trust proxy', 'uniquelocal');
  
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
      // Add detailed debugging for /auth/me endpoint
      if (req.path === '/me' && req.baseUrl === '/api/auth') {
        console.log(`[AUTH DEBUG] Accessing /api/auth/me endpoint`);
        console.log(`[AUTH DEBUG] Request cookies:`, req.cookies);
        console.log(`[AUTH DEBUG] Request headers:`, {
          authorization: req.headers.authorization ? 'Present (not shown for security)' : 'Not present',
          cookie: req.headers.cookie ? 'Present (not shown for security)' : 'Not present'
        });
      }
      
      // Use our imported token utilities to extract and verify the token
      const token = extractTokenFromRequest(req);
      
      // Enhanced debug logging for authentication
      if (req.path.startsWith('/api/admin')) {
        console.log(`[AUTH DEBUG] Admin route request: ${req.method} ${req.path}`);
        console.log(`[AUTH DEBUG] Extracted token exists: ${!!token}`);
        if (token) {
          try {
            // Log token details for debugging (partial token only for security)
            const tokenShort = token.substring(0, 10) + '...' + token.substring(token.length - 5);
            console.log(`[AUTH DEBUG] Token: ${tokenShort}`);
            
            // Validate token format
            const parts = token.split('.');
            if (parts.length !== 3) {
              console.log(`[AUTH DEBUG] Invalid JWT format: does not contain 3 parts`);
            } else {
              try {
                // Decode JWT header and payload (without verification) for debugging
                const decodedHeader = JSON.parse(Buffer.from(parts[0], 'base64').toString());
                const decodedPayload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
                console.log(`[AUTH DEBUG] Token header:`, decodedHeader);
                console.log(`[AUTH DEBUG] Token payload:`, decodedPayload);
              } catch (parseErr) {
                console.log(`[AUTH DEBUG] Error parsing token parts: ${parseErr.message}`);
              }
            }
          } catch (tokenLogErr) {
            console.log(`[AUTH DEBUG] Error logging token details: ${tokenLogErr.message}`);
          }
        }
        
        // Check for auth headers
        if (req.headers.authorization) {
          console.log(`[AUTH DEBUG] Authorization header exists: ${req.headers.authorization.substring(0, 15)}...`);
        } else {
          console.log(`[AUTH DEBUG] No Authorization header found`);
        }
        
        // Check for cookies
        if (req.cookies) {
          console.log(`[AUTH DEBUG] Cookies:`, Object.keys(req.cookies));
          if (req.cookies.auth_token) {
            console.log(`[AUTH DEBUG] auth_token cookie exists (length: ${req.cookies.auth_token.length})`);
          }
          if (req.cookies.token) {
            console.log(`[AUTH DEBUG] token cookie exists (length: ${req.cookies.token.length})`);
          }
        } else {
          console.log(`[AUTH DEBUG] No cookies found`);
        }
      }
      
      if (token) {
        try {
          // Verify token using our enhanced verification with more secure algorithm
          const decoded = verifyToken(token);
          
          if (req.path.startsWith('/api/admin')) {
            console.log(`[AUTH DEBUG] Token verification result:`, decoded ? 'Valid' : 'Invalid');
            if (decoded) {
              console.log(`[AUTH DEBUG] Decoded token:`, decoded);
            }
          }
          
          if (decoded && typeof decoded === 'object' && decoded.userId) {
            // Get user from database with detailed error handling
            try {
              const user = await storage.getUser(decoded.userId);
              
              if (req.path.startsWith('/api/admin')) {
                console.log(`[AUTH DEBUG] User from database:`, user ? { 
                  id: user.id, 
                  email: user.email,
                  role: user.role 
                } : 'Not found');
              }
              
              if (user) {
                // Attach user to request object with the role from token for additional verification
                // CRITICAL FIX: Ensure role from token takes precedence if available
                const role = decoded.role || user.role || 'user';
                
                req.user = {
                  ...user,
                  role // Use the explicit role assignment to ensure it's set correctly
                };
                
                if (req.path.startsWith('/api/admin')) {
                  console.log(`[AUTH DEBUG] Final user object with role:`, { 
                    id: req.user.id, 
                    email: req.user.email, 
                    role: req.user.role 
                  });
                }
                
                // Log successful authentication
                logger.debug({
                  message: `User authenticated: ${user.email} (${user.id}) with role ${req.user.role}`,
                  category: "security",
                  userId: user.id,
                  source: "internal",
                  metadata: {
                    path: req.path,
                    method: req.method,
                    role: req.user.role,
                    tokenRole: decoded.role,
                    dbRole: user.role
                  }
                });
              } else {
                // Log token with valid user ID but user not found in database
                logger.warn({
                  message: `JWT token contains valid user ID ${decoded.userId} but user not found in database`,
                  category: "security",
                  source: "internal",
                  metadata: {
                    path: req.path,
                    tokenUserId: decoded.userId
                  }
                });
              }
            } catch (dbError) {
              // Log database error during user fetch
              logger.error({
                message: `Database error fetching user: ${dbError instanceof Error ? dbError.message : String(dbError)}`,
                category: "database",
                source: "internal",
                metadata: {
                  error: dbError instanceof Error ? dbError.message : String(dbError),
                  path: req.path,
                  tokenUserId: decoded.userId
                }
              });
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
                path: req.path,
                error: tokenError instanceof Error ? tokenError.message : String(tokenError)
              }
            });
            
            if (req.path.startsWith('/api/admin')) {
              console.log(`[AUTH DEBUG] Token validation error: ${tokenError.message}`);
            }
          } else {
            // Log when token expires for tracking
            logger.info({
              message: 'JWT token expired',
              category: "security",
              source: "internal",
              metadata: {
                path: req.path
              }
            });
            
            if (req.path.startsWith('/api/admin')) {
              console.log(`[AUTH DEBUG] Token expired`);
            }
          }
        }
      } else if (req.path.startsWith('/api/admin')) {
        console.log(`[AUTH DEBUG] No token found for admin route`);
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
          path: req.path,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        }
      });
      
      if (req.path.startsWith('/api/admin')) {
        console.log(`[AUTH DEBUG] Authentication middleware error: ${error.message}`);
      }
      
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
  
  // Add API proxy middleware AFTER routes to catch unhandled API routes
  app.use(apiProxyMiddleware);
  
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