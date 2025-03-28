import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import { sessionStore } from "./middleware/auth";
import { registerRoutes } from "./routes.optimized";
import { logger } from "./services/logger";

// Create Express application
const app = express();

// Apply middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  credentials: true
}));

// Configure session
app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || "default_session_secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  },
}));

// Register routes
async function start() {
  try {
    // Register all routes
    const server = await registerRoutes(app);
    
    // Determine port
    const port = process.env.PORT || 5000;
    
    // Start server
    server.listen(port, () => {
      logger.info({
        message: `Server running on port ${port}`,
        category: "system",
        source: "startup"
      });
      console.log(`✨ Server is running on port ${port}`);
    });
    
    // Handle graceful shutdown
    process.on("SIGTERM", () => {
      logger.info({
        message: "SIGTERM received, shutting down gracefully",
        category: "system",
        source: "shutdown"
      });
      
      server.close(() => {
        logger.info({
          message: "HTTP server closed",
          category: "system",
          source: "shutdown"
        });
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error({
      message: `Failed to start server: ${error instanceof Error ? error.message : String(error)}`,
      category: "system",
      source: "startup",
      metadata: {
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Start the server
start();