import express, { Request, Response, Router } from "express";
import { authenticateToken, isAdmin } from "../middleware/auth";
import { storage } from "../storage";
import { logger } from "../services/logger";
import crypto from 'crypto';
import emailService from '../services/email';

const adminRouter = Router();

// Apply admin authentication middleware to all admin routes
adminRouter.use(authenticateToken);
adminRouter.use(isAdmin);

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

    // Get merchant by ID
    const merchant = await storage.getMerchant(id);
    
    // Get all contracts for this merchant
    const merchantContracts = await storage.getContractsByMerchantId(id);

    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found"
      });
    }

    res.json({
      success: true,
      data: {
        ...merchant,
        contracts: merchantContracts.map(contract => ({
          id: contract.id,
          status: contract.status,
          contractNumber: contract.contractNumber,
          createdAt: contract.createdAt
        }))
      }
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
    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields"
      });
    }

    // Check if merchant already exists by email
    const allMerchants = await storage.getAllMerchants();
    const existingMerchant = allMerchants.find(m => m.email === email);

    if (existingMerchant) {
      return res.status(409).json({
        success: false,
        message: "Merchant with this email already exists"
      });
    }

    // Create new merchant
    const merchant = await storage.createMerchant({
      name,
      contactName: name, // Using the name as contact name for simplicity
      email,
      phone: phoneNumber || '',
      address,
      active: true,
      archived: false
    });

    // Generate a temporary password for the merchant
    const tempPassword = crypto.randomBytes(8).toString('hex');

    // Create user account for merchant
    await storage.createUser({
      email,
      password: tempPassword, // This should be hashed in a real app
      role: "merchant",
      firstName: name.split(' ')[0],
      lastName: name.split(' ').slice(1).join(' ')
    });

    // Send welcome email with temporary password
    await emailService.sendMerchantWelcome(email, name, tempPassword);

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