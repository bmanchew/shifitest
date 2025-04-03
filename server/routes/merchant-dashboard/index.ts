import { Router, Request, Response } from "express";
import { authenticateToken, isMerchant } from "../../middleware/auth";
import fundingRouter from "./funding";
import { storage } from "../../storage";
import { logger } from "../../services/logger";

const router = Router();

// Apply authentication to all dashboard routes
router.use(authenticateToken);

// Apply merchant role check to all dashboard routes
router.use(isMerchant);

// Create a /current endpoint in the merchant dashboard to display the current merchant's information
router.get("/current", async (req: Request, res: Response) => {
  try {
    logger.info({
      message: "Merchant dashboard GET /current endpoint accessed",
      category: "api",
      userId: req.user?.id,
      source: "internal",
      metadata: {
        path: req.path,
        originalUrl: req.originalUrl,
        fullPath: `${req.baseUrl}${req.path}`
      }
    });

    // Check if user exists and is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }
    
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

// Mount the funding routes under /funding
router.use("/funding", fundingRouter);

export default router;