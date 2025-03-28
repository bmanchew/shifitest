import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes"; // Using our new routes structure
import { setupVite, serveStatic, log } from "./vite";
import { logger, requestLogger } from "./services/logger";
import { storage } from "./storage";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { csrfProtectionWithExclusions, csrfTokenHandler, csrfErrorHandler } from "./middleware/csrfMiddleware";
import jwt from "jsonwebtoken";
import { errorHandler } from "./services/errorHandler";

const app = express();
app.use(express.json());
app.use(cookieParser()); // Add cookie-parser middleware

// Add Helmet for improved security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://js.stripe.com", "https://cdn.plaid.com"],
        connectSrc: ["'self'", "https://*.plaid.com", "https://*.stripe.com", "https://api.prefi.io"],
        frameSrc: ["'self'", "https://js.stripe.com", "https://cdn.plaid.com", "https://link.plaid.com"],
        imgSrc: ["'self'", "data:", "https:"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    // Setting a long duration for HSTS
    strictTransportSecurity: {
      maxAge: 63072000, // 2 years in seconds
      includeSubDomains: true,
      preload: true
    },
    // Prevent clickjacking
    frameguard: { 
      action: "deny" 
    }
  })
);

// Validate required environment variables
const requiredEnvVars: string[] = [
  // Make external API integrations optional to ensure server can start
  // "PLAID_CLIENT_ID",
  // "PLAID_SECRET",
  // "PLAID_ENVIRONMENT", 
  // "PREFI_API_KEY",
  // "NLPEARL_ACCOUNT_ID",
  // "NLPEARL_API_KEY",
  // "NLPEARL_CAMPAIGN_ID",
  // The CFPB API is public and doesn't require an API key
];

// Validate Plaid environment format
const validPlaidEnvironments = ['sandbox', 'development', 'production'];
if (process.env.PLAID_ENVIRONMENT && !validPlaidEnvironments.includes(process.env.PLAID_ENVIRONMENT)) {
  logger.error({
    message: `Invalid PLAID_ENVIRONMENT value: ${process.env.PLAID_ENVIRONMENT}. Must be one of: ${validPlaidEnvironments.join(', ')}`,
    category: "system",
    metadata: {
      currentValue: process.env.PLAID_ENVIRONMENT,
      validValues: validPlaidEnvironments
    },
    tags: ["startup", "configuration", "error"]
  });
}

const missingEnvVars = requiredEnvVars.filter(
  (varName) => !process.env[varName],
);

if (missingEnvVars.length > 0) {
  console.error(
    "ERROR: Missing required environment variables:",
    missingEnvVars.join(", "),
  );
  console.error("Please set these variables in the Secrets tab");
}

app.use(express.urlencoded({ extended: false }));

// Enable CORS for all routes with credentials support, with special handling for .replit.dev domain
app.use((req, res, next) => {
  // Get the Replit ID from environment variables
  const replitId = process.env.REPL_ID || '';
  
  // Create a list of allowed origins that includes .replit.dev domain and other domains
  const allowedOrigins = [
    // Primary domain (.replit.dev)
    `https://${replitId}.replit.dev`,
    // Janeway domain (for development)
    process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : undefined,
    // Current origin (if any)
    req.headers.origin || "*",
    // Public URL if set
    process.env.PUBLIC_URL || "*"
  ].filter(Boolean); // Remove any undefined entries
  
  // Log origins in dev mode
  if (process.env.NODE_ENV === 'development') {
    console.log(`Incoming request from origin: ${req.headers.origin}`);
    console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
  }
  
  // Handle CORS headers
  const origin = req.headers.origin;
  if (origin) {
    // Check if the origin is allowed
    const isAllowed = allowedOrigins.includes(origin) || 
                      origin.endsWith('.replit.dev') || 
                      origin.includes('.replit.co');
    
    if (isAllowed) {
      // Allow the specific origin that made the request
      res.header("Access-Control-Allow-Origin", origin);
    } else {
      // Fall back to the .replit.dev domain
      res.header("Access-Control-Allow-Origin", `https://${replitId}.replit.dev`);
    }
  } else {
    // No origin header, use the default .replit.dev domain
    res.header("Access-Control-Allow-Origin", `https://${replitId}.replit.dev`);
  }
  
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  res.header("Access-Control-Allow-Credentials", "true");
  
  // Handle preflight requests
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
        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_jwt_secret');
        
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
        path: req.path,
        errorStack: error instanceof Error ? error.stack : String(error)
      }
    });
    next();
  }
});

/**
 * Helper function to extract token from request
 * @param req Express Request
 * @returns Token string or null
 */
function getTokenFromRequest(req: Request): string | null {
  // Check Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Check cookies
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  
  return null;
}

// Add the request logger middleware for enhanced logging
app.use(requestLogger);

// Apply our enhanced CSRF protection middleware with exclusions
app.use('/api', csrfProtectionWithExclusions);

// Add a route to get a CSRF token
app.get('/api/csrf-token', csrfTokenHandler);

// Add CSRF error handler
app.use(csrfErrorHandler);

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
  // Use a more robust singleton pattern with a static server instance
  const serverInstanceKey = "server_instance";

  // Check if we already have a server instance
  if ((global as any)[serverInstanceKey]) {
    logger.warn({
      message: "Server startup attempted but server is already running",
      category: "system",
      metadata: { alreadyRunning: true },
    });
    return (global as any)[serverInstanceKey]; // Return the existing server instance
  }

  // Set up cleanup to release resources on process termination
  const cleanup = () => {
    const server = (global as any)[serverInstanceKey];
    if (server && server.listening) {
      logger.info({
        message: "Shutting down server gracefully",
        category: "system",
      });
      server.close(() => {
        logger.info({
          message: "Server shutdown complete",
          category: "system",
        });
        (global as any)[serverInstanceKey] = null;
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  };

  // Handle termination signals
  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  process.on("uncaughtException", (err) => {
    logger.error({
      message: `Uncaught exception: ${err.message}`,
      category: "system",
      metadata: {
        error: err.message,
        stack: err.stack,
      },
    });
    cleanup();
  });

  try {
    // Seed the database with initial data if needed
    try {
      // Check if database needs seeding and seed it
      if ("seedInitialData" in storage) {
        await (storage as any).seedInitialData();
      }

      // Run any pending migrations
      try {
        // Import runMigrations function using dynamic import
        const { runMigrations } = await import("./migrations/index");
        await runMigrations();
        logger.info({
          message: "Database migrations completed during startup",
          category: "system",
        });
      } catch (migrationError) {
        logger.warn({
          message: `Could not run migrations: ${migrationError instanceof Error ? migrationError.message : String(migrationError)}`,
          category: "system",
          metadata: { error: String(migrationError) },
        });
      }
    } catch (error) {
      console.error("Error initializing database:", error);
      logger.error({
        message: "Error initializing database",
        category: "system",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
    }

    const server = await registerRoutes(app);
    // Check if Plaid credentials are available
    const hasPlaidCredentials = process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET;
    console.log("Plaid credentials available:", hasPlaidCredentials ? "Yes" : "No");

    // Use the enhanced error handler middleware
    app.use(errorHandler);

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

    // Production deployment must use port 5000 consistently for Cloud Run
    const isProd = process.env.NODE_ENV === 'production';
    const basePort = isProd ? 5000 : (process.env.PORT ? parseInt(process.env.PORT, 10) : 5000);
    let currentPort = basePort;
    const maxPortAttempts = isProd ? 1 : 10; // In production, don't attempt different ports
    
    // Log important configuration on startup
    logger.info({
      message: `Starting server in environment: ${process.env.NODE_ENV || 'development'}`,
      category: "system",
      metadata: {
        plaidEnvironment: process.env.PLAID_ENVIRONMENT || 'not set',
        portConfiguration: 'internal 5000 → external 80'
      },
      tags: ["startup", "configuration"]
    });

    const findAvailablePort = async (): Promise<number> => {
      return new Promise((resolve, reject) => {
        let attempts = 0;
        const checkPort = (port: number) => {
          // Use dynamic import instead of require for ESM compatibility
          import("net")
            .then((netModule) => {
              const tester = netModule
                .createServer()
                .once("error", (err: Error & { code?: string }) => {
                  if (err.code === "EADDRINUSE") {
                    if (attempts >= maxPortAttempts) {
                      return reject(
                        new Error(
                          "Could not find an available port after multiple attempts",
                        ),
                      );
                    }
                    attempts++;
                    log(`Port ${port} is in use, trying ${port + 1}`);
                    tester.close(() => checkPort(port + 1));
                  } else {
                    reject(err);
                  }
                })
                .once("listening", () => {
                  tester.close(() => resolve(port));
                })
                .listen(port, "0.0.0.0");
            })
            .catch((err) => reject(err));
        };

        checkPort(currentPort);
      });
    };

    // Start the server on an available port
    try {
      // Check for environment variable PORT
      const envPort = process.env.PORT ? parseInt(process.env.PORT, 10) : null;
      const forcePort = process.env.FORCE_PORT === 'true';
      
      // If PORT is set and FORCE_PORT is true, use that port directly
      if (envPort && forcePort) {
        console.log(`Starting server on forced port ${envPort} from environment variable...`);
        const httpServer = server.listen(
          {
            port: envPort,
            host: "0.0.0.0",
            reusePort: false,
          },
          () => {
            const serverAddress = httpServer.address();
            if (serverAddress && typeof serverAddress !== 'string') {
              const { port } = serverAddress;
              console.log(`Server is running at http://0.0.0.0:${port}`);
              
              logger.info({
                message: `Server started on port ${port}`,
                category: "system",
                source: "internal",
                metadata: {
                  port,
                  host: '0.0.0.0'
                }
              });
            }
          }
        );
        
        // Setup error handling for the server
        httpServer.on("error", (err: Error) => {
          logger.error({
            message: `Server error: ${err.message}`,
            category: "system",
            source: "internal",
            metadata: {
              error: err.message,
              stack: err.stack
            }
          });
          console.error("Server error:", err);
        });
        
        return httpServer;
      }
      
      // Otherwise use the port finding logic
      console.log("Starting server on port 5000...");
      // Try to start on port 5000 by default
      const defaultPort = envPort || 5000;
      const maxPort = defaultPort + 10; // Allow up to 10 port attempts
      let currentPort = defaultPort;
      let serverStarted = false;
      
      // Helper function to try starting the server on a specific port
      const tryStartServer = async (port: number): Promise<any> => {
        return new Promise(async (resolve, reject) => {
          // First check if port is available
          const net = await import('net');
          const tester = net.createServer()
            .once('error', (err: Error & { code?: string }) => {
              // Port in use, try next port
              if (err.code === 'EADDRINUSE') {
                if (port >= maxPort) {
                  return reject(new Error(`Could not find an available port between ${defaultPort} and ${maxPort}`));
                }
                
                logger.warn({
                  message: `Port ${port} is in use, trying port ${port + 1}`,
                  category: "system",
                  source: "internal"
                });
                
                // Try the next port
                tester.close(() => {
                  resolve(tryStartServer(port + 1));
                });
              } else {
                reject(err);
              }
            })
            .once('listening', () => {
              // Port is available, use it to start the actual server
              tester.close(async () => {
                try {
                  // Start the actual server on this available port
                  console.log(`Starting server on port ${port}...`);
                  const httpServer = server.listen(
                    {
                      port: port,
                      host: "0.0.0.0",
                      reusePort: false,
                    },
                    () => {
                      const serverAddress = httpServer.address();
                      const actualPort =
                        typeof serverAddress === "object" && serverAddress
                          ? serverAddress.port
                          : port;
                          
                      // Mark server as successfully started
                      serverStarted = true;
                      
                      log(`Server listening on http://0.0.0.0:${actualPort}`);
                      logger.info({
                        message: `ShiFi server started on port ${actualPort}`,
                        category: "system",
                        metadata: {
                          environment: app.get("env"),
                          nodeVersion: process.version,
                          address: "0.0.0.0",
                          port: actualPort,
                          deployment: isProd ? 'cloud-run' : 'development'
                        },
                        tags: ["startup", "server"],
                      });
                      
                      // Store the server instance globally to prevent multiple instances
                      (global as any)["server_instance"] = httpServer;
                      resolve(httpServer);
                    }
                  );
                  
                  // Set up error handling for the server
                  httpServer.on("error", (err: Error) => {
                    console.error(`SERVER ERROR: ${err.message}`);
                    logger.error({
                      message: `Server error: ${err.message}`,
                      category: "system",
                      metadata: { error: err.message, stack: err.stack },
                    });
                    
                    if (!serverStarted) {
                      reject(err);
                    }
                  });
                } catch (err) {
                  reject(err);
                }
              });
            })
            .listen(port, '0.0.0.0');
        });
      };
      
      // Try to start the server with our helper function
      const httpServer = await tryStartServer(currentPort);
    } catch (error) {
      logger.error({
        message: `Failed to start server: ${error instanceof Error ? error.message : String(error)}`,
        category: "system",
        metadata: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
      throw error;
    }
  } catch (error) {
    logger.error({
      message: `Critical error starting server: ${error instanceof Error ? error.message : String(error)}`,
      category: "system",
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    });
    // Release startup lock to allow for restart attempts
    (global as any)["server_startup_lock"] = false;
  }
}

// Implement a global semaphore to prevent multiple server instances
const globalStartupLock = "server_startup_lock";

// Only proceed if we don't have a lock already
if (!(global as any)[globalStartupLock]) {
  // Set the lock before attempting to start
  (global as any)[globalStartupLock] = true;

  // Add diagnostic logging to help troubleshoot startup issues
  console.log("Starting server with DATABASE_URL:", process.env.DATABASE_URL ? "Database URL is set" : "DATABASE_URL is not set");
  console.log("Checking for all required environment variables...");
  if (process.env.PREFI_API_KEY) console.log("✓ PREFI_API_KEY is set");
  if (process.env.PLAID_CLIENT_ID) console.log("✓ PLAID_CLIENT_ID is set");
  if (process.env.PLAID_SECRET) console.log("✓ PLAID_SECRET is set");

  try {
    startServer().catch((err) => {
      console.error("Failed to start server:", err);
      logger.error({
        message: `Failed to start server: ${err.message}`,
        category: "system",
        metadata: {
          error: err.message,
          stack: err.stack,
        },
      });
      // Release lock on error
      (global as any)[globalStartupLock] = false;
    });
  } catch (err) {
    console.error("Error starting server:", err);
    logger.error({
      message: `Error starting server: ${err instanceof Error ? err.message : String(err)}`,
      category: "system",
      metadata: {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      },
    });
    // Release lock on error
    (global as any)[globalStartupLock] = false;
  }
} else {
  logger.info({
    message:
      "Server startup already in progress, skipping duplicate startup attempt",
    category: "system",
  });
}
