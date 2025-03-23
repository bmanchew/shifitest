
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
    // Get user ID from session or JWT token
    const userId = req.headers.userid as string || req.body.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }
    
    // Get user from database
    const user = await storage.getUserById(parseInt(userId));
    
    if (!user || user.role !== "admin") {
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
