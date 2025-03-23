import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { logger } from "../services/logger";

// Middleware to authenticate admins
export const authenticateAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Check various possible sources for the user ID
    const userId = 
      req.headers.userid as string || 
      req.headers['user-id'] as string || 
      req.query.userId as string || 
      req.body.userId;

    if (!userId) {
      logger.warn({
        message: "Authentication failed: No user ID provided",
        category: "security",
        metadata: {
          headers: req.headers,
          path: req.path
        }
      });

      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Get user from database
    const user = await storage.getUser(parseInt(userId));

    if (!user) {
      logger.warn({
        message: `Authentication failed: User not found with ID ${userId}`,
        category: "security",
        metadata: { userId }
      });

      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.role !== "admin") {
      logger.warn({
        message: `Authorization failed: User ${userId} (${user.email}) is not an admin`,
        category: "security",
        metadata: { userId, userRole: user.role }
      });

      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    // Add user to request for later use
    (req as any).user = user;

    // User is an admin, proceed
    next();
  } catch (error) {
    logger.error({
      message: `Authentication error: ${error instanceof Error ? error.message : String(error)}`,
      category: "security",
      metadata: {
        error: error instanceof Error ? error.stack : String(error),
      },
    });

    return res.status(500).json({
      success: false,
      message: "Authentication error",
    });
  }
};

// Middleware to check if user is an admin
export const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  const user = (req as any).user;

  if (!user || user.role !== 'admin') {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Admin access required'
    });
  }

  next();
};