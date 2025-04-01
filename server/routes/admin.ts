import express, { Request, Response, Router } from "express";
import { authenticateToken, isAdmin } from "../middleware/auth";
import { storage } from "../storage";
import { logger } from "../services/logger";
import crypto from 'crypto';
import emailService from '../services/email';
import adminModularRouter from "./admin/index";

const adminRouter = Router();

// Apply admin authentication middleware to all admin routes
adminRouter.use(authenticateToken);
adminRouter.use(isAdmin);

// Mount the modular admin routes
adminRouter.use(adminModularRouter);

// Get dashboard statistics
adminRouter.get("/dashboard-stats", async (req: Request, res: Response) => {
  try {
    // Fetch dashboard statistics from database
    // Get all contracts and filter for pending status
    const allContracts = await storage.getAllContracts();
    const pendingContracts = allContracts.filter(contract => contract.status === "pending").length;
    
    // Get total users count
    const allUsers = await storage.getAllUsers();
    const totalUsers = allUsers.length;
    
    // Get total merchants count
    const allMerchants = await storage.getAllMerchants();
    const totalMerchants = allMerchants.length;
    
    // Count active merchants (where active = true and archived = false)
    const activeMerchants = allMerchants.filter(
      merchant => merchant.active === true && merchant.archived === false
    ).length;
    
    // Count active contracts
    const activeContracts = allContracts.filter(contract => contract.status === "active").length;

    // Return dashboard statistics
    res.json({
      success: true,
      data: {
        pendingContracts,
        totalUsers,
        totalMerchants,
        activeMerchants,  // Add the active merchants count
        activeContracts
      }
    });
  } catch (error) {
    logger.error({
      message: `Failed to fetch dashboard stats: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        error: error instanceof Error ? error.stack : null
      }
    });

    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard statistics",
      error: error instanceof Error ? error.message : String(error) //Added more detailed error information
    });
  }
});

// Note: The merchant routes have been moved to the modular merchants router
// in routes/admin/merchants.ts
//
// This includes:
// - GET /merchants
// - GET /merchants/:id
// - POST /merchants
//
// We're using the modular routes to avoid duplication and potential conflicts

export default adminRouter;