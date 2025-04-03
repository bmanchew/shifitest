import { Router, Request, Response } from "express";
import { authenticateToken } from "../middleware/auth";
import { storage } from "../storage";
import { logger } from "../services/logger";

const router = Router();

// Apply authentication middleware
router.use(authenticateToken);

// Current merchant endpoint - dedicated endpoint for merchant details
router.get("/", async (req: Request, res: Response) => {
  try {
    // Check if user exists and is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }
    
    // Log user information for debugging
    logger.info({
      message: `Current merchant endpoint accessed by user ID ${req.user.id}, email: ${req.user.email}, role: ${req.user.role}`,
      category: 'api',
      userId: req.user.id,
      source: 'internal',
      metadata: {
        userRole: req.user.role,
        path: req.path,
        originalUrl: req.originalUrl
      }
    });
    
    // Check if user is a merchant
    if (req.user.role !== 'merchant') {
      logger.warn({
        message: `User ${req.user.email} (${req.user.id}) attempted to access merchant resource with role ${req.user.role}`,
        category: 'security',
        userId: req.user.id,
        source: 'internal'
      });
      
      return res.status(403).json({
        success: false,
        message: "Merchant access required"
      });
    }
    
    // Check if user ID is valid
    if (typeof req.user.id !== 'number' || isNaN(req.user.id)) {
      logger.error({
        message: `Invalid user ID format: ${req.user.id}`,
        category: 'api',
        userId: req.user.id,
        source: 'internal'
      });
      
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format",
        debug: { userId: req.user.id, type: typeof req.user.id }
      });
    }
    
    // Get the merchant associated with the authenticated user
    const merchant = await storage.getMerchantByUserId(req.user.id);
    
    if (!merchant) {
      logger.warn({
        message: `No merchant found for user ID ${req.user.id}`,
        userId: req.user.id,
        category: 'api',
        source: 'internal'
      });
      return res.status(404).json({ 
        success: false,
        message: "No merchant found for the authenticated user" 
      });
    }
    
    // Return the merchant data
    return res.status(200).json({
      success: true,
      data: merchant
    });
  } catch (error) {
    // Handle any errors gracefully
    logger.error({
      message: `Error fetching current merchant: ${error instanceof Error ? error.message : String(error)}`,
      userId: req.user?.id, 
      category: 'api',
      source: 'internal',
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Error fetching merchant information"
    });
  }
});

export default router;