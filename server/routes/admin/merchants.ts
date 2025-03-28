import express, { Request, Response } from "express";
import { storage } from "../../storage";
import { logger } from "../../services/logger";

const router = express.Router();

// Get all merchants
router.get("/", async (req: Request, res: Response) => {
  try {
    logger.info({
      message: "Admin requesting all merchants list",
      category: "api",
      userId: req.user?.id,
      source: "internal",
      metadata: {
        path: req.path,
        method: req.method
      }
    });
    
    const merchants = await storage.getAllMerchants();
    res.json({ success: true, merchants });
  } catch (error) {
    logger.error({
      message: `Error fetching merchants: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      userId: req.user?.id,
      source: "internal",
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: req.path,
        method: req.method
      }
    });
    
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch merchants",
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;