import express, { Request, Response, Router } from "express";
import { authenticateAdmin } from "../middleware/auth";
import { storage } from "../storage";
import { logger } from "../services/logger";
import crypto from 'crypto';
import emailService from '../services/email';

const adminRouter = Router();

// Apply admin authentication middleware to all admin routes
adminRouter.use(authenticateAdmin);

// Get dashboard statistics
adminRouter.get("/dashboard-stats", async (req: Request, res: Response) => {
  try {
    // Fetch dashboard statistics from database
    const pendingContracts = await storage.contract.count({
      where: { status: "pending" }
    });

    const totalUsers = await storage.user.count();

    const totalMerchants = await storage.merchant.count();

    // Count active merchants (where active = true and archived = false)
    const activeMerchants = await storage.merchant.count({
      where: { 
        active: true,
        archived: false
      }
    });

    const activeContracts = await storage.contract.count({
      where: { status: "active" }
    });

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

// Get all merchants
adminRouter.get("/merchants", async (_req: Request, res: Response) => {
  try {
    const merchants = await storage.getAllMerchants();

    return res.json({
      success: true,
      merchants
    });
  } catch (error) {
    console.error("Error fetching merchants:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to fetch merchants",
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get a specific merchant by ID
adminRouter.get("/merchants/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    const merchant = await storage.merchant.findUnique({
      where: { id },
      include: {
        contracts: {
          select: {
            id: true,
            status: true,
            contractNumber: true,
            createdAt: true,
            updatedAt: true
          }
        }
      }
    });

    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found"
      });
    }

    res.json({
      success: true,
      data: merchant
    });
  } catch (error) {
    logger.error({
      message: `Failed to fetch merchant: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        error: error instanceof Error ? error.stack : null
      }
    });

    res.status(500).json({
      success: false,
      message: "Failed to fetch merchant details"
    });
  }
});

// Create a new merchant account
adminRouter.post("/merchants", async (req: Request, res: Response) => {
  try {
    const { name, email, businessType, address, phoneNumber } = req.body;

    // Validate required fields
    if (!name || !email || !businessType) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    // Check if merchant already exists
    const existingMerchant = await storage.merchant.findFirst({
      where: { email }
    });

    if (existingMerchant) {
      return res.status(409).json({
        success: false,
        message: "Merchant with this email already exists"
      });
    }

    // Create new merchant
    const merchant = await storage.merchant.create({
      data: {
        name,
        email,
        businessType,
        address,
        phoneNumber,
        status: "active"
      }
    });

    // Generate a temporary password for the merchant
    const tempPassword = crypto.randomBytes(8).toString('hex');

    // Create user account for merchant
    await storage.user.create({
      data: {
        email,
        password: tempPassword, // This should be hashed in a real app
        role: "merchant",
        merchantId: merchant.id
      }
    });

    // Send welcome email with temporary password
    await emailService.sendMerchantWelcomeEmail(email, {
      merchantName: name,
      tempPassword
    });

    res.status(201).json({
      success: true,
      data: merchant
    });
  } catch (error) {
    logger.error({
      message: `Failed to create merchant: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        error: error instanceof Error ? error.stack : null
      }
    });

    res.status(500).json({
      success: false,
      message: "Failed to create merchant account"
    });
  }
});

export default adminRouter;