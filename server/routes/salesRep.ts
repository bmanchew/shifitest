/**
 * Sales Rep Router
 * Handles all routes related to sales representatives management
 */

import express, { Request, Response } from "express";
import { fromZodError } from "zod-validation-error";
import { ZodError } from "zod";
import { salesRepAnalyticsService } from "../services/salesRepAnalytics";
import { db } from "../db";
import { storage } from "../storage";
import { logger } from "../services/logger";
import { z } from "zod";

const router = express.Router();

/**
 * POST /sales-reps/:id/refresh-analytics
 * Refresh analytics data for a specific sales rep
 */
router.post("/:id/refresh-analytics", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sales rep ID"
      });
    }

    // Verify the sales rep exists
    const salesRep = await storage.getSalesRep(id);
    if (!salesRep) {
      return res.status(404).json({
        success: false,
        message: "Sales rep not found"
      });
    }

    // Update analytics for the sales rep
    await salesRepAnalyticsService.updateAnalyticsForSalesRep(id);
    
    logger.info({
      message: `Analytics refreshed for sales rep ID ${id}`,
      category: "api",
      source: "sales_rep",
      metadata: {
        salesRepId: id
      }
    });

    return res.json({
      success: true,
      message: "Sales rep analytics refreshed successfully"
    });
    
  } catch (error) {
    logger.error({
      message: `Error refreshing sales rep analytics: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "sales_rep",
      metadata: {
        salesRepId: req.params.id,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to refresh sales rep analytics"
    });
  }
});

// Schema for creating a new sales rep
const createSalesRepSchema = z.object({
  userId: z.number(),
  merchantId: z.number(),
  title: z.string().optional(),
  commissionRate: z.number().optional(),
  commissionRateType: z.enum(["percentage", "fixed"]).optional(),
  maxAllowedFinanceAmount: z.number().optional(),
  target: z.number().optional(),
  notes: z.string().optional()
});

// Schema for updating a sales rep
const updateSalesRepSchema = z.object({
  title: z.string().optional(),
  active: z.boolean().optional(),
  commissionRate: z.number().optional(),
  commissionRateType: z.enum(["percentage", "fixed"]).optional(),
  maxAllowedFinanceAmount: z.number().optional(),
  target: z.number().optional(),
  notes: z.string().optional()
});

// Schema for creating a commission record
const createCommissionSchema = z.object({
  salesRepId: z.number(),
  contractId: z.number(),
  amount: z.number(),
  rate: z.number(),
  rateType: z.enum(["percentage", "fixed"]),
  status: z.string().optional(),
  notes: z.string().optional()
});

// Schema for updating a commission record
const updateCommissionSchema = z.object({
  status: z.string().optional(),
  paidAt: z.date().optional(),
  notes: z.string().optional()
});

/**
 * GET /sales-reps
 * Get all sales reps for a merchant
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const merchantId = req.query.merchantId ? parseInt(req.query.merchantId as string) : undefined;
    
    if (!merchantId) {
      return res.status(400).json({
        success: false,
        message: "Merchant ID is required"
      });
    }

    const salesReps = await storage.getSalesRepsByMerchantId(merchantId);
    
    // For each sales rep, get analytics data
    const salesRepsWithAnalytics = await Promise.all(
      salesReps.map(async (rep) => {
        const analytics = await storage.getSalesRepAnalyticsBySalesRepId(rep.id);
        const commissions = await storage.getCommissionsBySalesRepId(rep.id);
        const user = await storage.getUser(rep.userId);
        
        // Calculate totals
        const totalCommissionEarned = commissions.reduce((total, comm) => total + comm.amount, 0);
        const totalCommissionPaid = commissions
          .filter(comm => comm.status === 'paid')
          .reduce((total, comm) => total + comm.amount, 0);
          
        return {
          ...rep,
          analytics: analytics.slice(0, 3), // Get most recent analytics
          earnings: {
            totalEarned: totalCommissionEarned,
            totalPaid: totalCommissionPaid,
            pending: totalCommissionEarned - totalCommissionPaid
          },
          user: user ? {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone
          } : null
        };
      })
    );

    logger.info({
      message: `Retrieved ${salesReps.length} sales reps for merchant ${merchantId}`,
      category: "api",
      source: "sales_rep",
      metadata: {
        merchantId
      }
    });

    return res.json({
      success: true,
      salesReps: salesRepsWithAnalytics
    });
    
  } catch (error) {
    logger.error({
      message: `Error retrieving sales reps: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "sales_rep",
      metadata: {
        merchantId: req.query.merchantId,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve sales representatives"
    });
  }
});

/**
 * GET /sales-reps/:id
 * Get a specific sales rep by ID
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sales rep ID"
      });
    }

    const salesRep = await storage.getSalesRep(id);
    if (!salesRep) {
      return res.status(404).json({
        success: false,
        message: "Sales rep not found"
      });
    }

    // Get analytics data
    const analytics = await storage.getSalesRepAnalyticsBySalesRepId(id);
    
    // Get commissions data
    const commissions = await storage.getCommissionsBySalesRepId(id);
    
    // Get user data
    const user = await storage.getUser(salesRep.userId);
    
    // Calculate totals
    const totalCommissionEarned = commissions.reduce((total, comm) => total + comm.amount, 0);
    const totalCommissionPaid = commissions
      .filter(comm => comm.status === 'paid')
      .reduce((total, comm) => total + comm.amount, 0);
    
    // Get contracts where this rep is assigned
    const contracts = await storage.getContractsBySalesRepId(id);
    
    return res.json({
      success: true,
      salesRep: {
        ...salesRep,
        analytics: analytics.slice(0, 5), // Get most recent analytics
        earnings: {
          totalEarned: totalCommissionEarned,
          totalPaid: totalCommissionPaid,
          pending: totalCommissionEarned - totalCommissionPaid
        },
        contracts: contracts.length,
        user: user ? {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone
        } : null
      }
    });
    
  } catch (error) {
    logger.error({
      message: `Error retrieving sales rep: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "sales_rep",
      metadata: {
        salesRepId: req.params.id,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve sales representative details"
    });
  }
});

/**
 * POST /sales-reps
 * Create a new sales rep
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const data = createSalesRepSchema.parse(req.body);
    
    // Verify the user exists and is not already a sales rep
    const user = await storage.getUser(data.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    
    // Check if user is already a sales rep
    const existingSalesRep = await storage.getSalesRepByUserId(data.userId);
    if (existingSalesRep) {
      return res.status(409).json({
        success: false,
        message: "This user is already a sales representative"
      });
    }
    
    // Verify the merchant exists
    const merchant = await storage.getMerchant(data.merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found"
      });
    }
    
    // Update user's role to "sales_rep"
    await storage.updateUser(user.id, { role: "sales_rep" });
    
    // Create the sales rep record
    const salesRep = await storage.createSalesRep({
      userId: data.userId,
      merchantId: data.merchantId,
      title: data.title,
      commissionRate: data.commissionRate,
      commissionRateType: data.commissionRateType,
      maxAllowedFinanceAmount: data.maxAllowedFinanceAmount,
      target: data.target,
      notes: data.notes,
      active: true
    });
    
    // Initialize analytics for the new sales rep
    await salesRepAnalyticsService.updateAnalyticsForSalesRep(salesRep.id);
    
    return res.status(201).json({
      success: true,
      salesRep
    });
    
  } catch (error) {
    if (error instanceof ZodError) {
      const formattedError = fromZodError(error);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: formattedError.details
      });
    }
    
    logger.error({
      message: `Error creating sales rep: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "sales_rep",
      metadata: {
        body: req.body,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to create sales representative"
    });
  }
});

/**
 * PATCH /sales-reps/:id
 * Update a sales rep
 */
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sales rep ID"
      });
    }
    
    const data = updateSalesRepSchema.parse(req.body);
    
    // Verify the sales rep exists
    const salesRep = await storage.getSalesRep(id);
    if (!salesRep) {
      return res.status(404).json({
        success: false,
        message: "Sales rep not found"
      });
    }
    
    // Update the sales rep
    const updatedSalesRep = await storage.updateSalesRep(id, data);
    
    // If the sales rep is being deactivated, update the user's role
    if (data.active === false) {
      await storage.updateUser(salesRep.userId, { role: "customer" });
    } else if (data.active === true) {
      // Ensure role is set to sales_rep if activating
      await storage.updateUser(salesRep.userId, { role: "sales_rep" });
    }
    
    return res.json({
      success: true,
      salesRep: updatedSalesRep
    });
    
  } catch (error) {
    if (error instanceof ZodError) {
      const formattedError = fromZodError(error);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: formattedError.details
      });
    }
    
    logger.error({
      message: `Error updating sales rep: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "sales_rep",
      metadata: {
        salesRepId: req.params.id,
        body: req.body,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to update sales representative"
    });
  }
});

/**
 * GET /sales-reps/:id/contracts
 * Get contracts associated with a sales rep
 */
router.get("/:id/contracts", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sales rep ID"
      });
    }
    
    // Verify the sales rep exists
    const salesRep = await storage.getSalesRep(id);
    if (!salesRep) {
      return res.status(404).json({
        success: false,
        message: "Sales rep not found"
      });
    }
    
    // Get contracts
    const contracts = await storage.getContractsBySalesRepId(id);
    
    return res.json({
      success: true,
      contracts
    });
    
  } catch (error) {
    logger.error({
      message: `Error retrieving sales rep contracts: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "sales_rep",
      metadata: {
        salesRepId: req.params.id,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve sales representative contracts"
    });
  }
});

/**
 * GET /sales-reps/:id/commissions
 * Get commissions for a sales rep
 */
router.get("/:id/commissions", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sales rep ID"
      });
    }
    
    // Verify the sales rep exists
    const salesRep = await storage.getSalesRep(id);
    if (!salesRep) {
      return res.status(404).json({
        success: false,
        message: "Sales rep not found"
      });
    }
    
    // Get commissions
    const commissions = await storage.getCommissionsBySalesRepId(id);
    
    // Get contract details for each commission
    const commissionsWithDetails = await Promise.all(
      commissions.map(async (commission) => {
        const contract = await storage.getContract(commission.contractId);
        return {
          ...commission,
          contract: contract ? {
            id: contract.id,
            contractNumber: contract.contractNumber,
            amount: contract.amount,
            status: contract.status,
            createdAt: contract.createdAt
          } : null
        };
      })
    );
    
    return res.json({
      success: true,
      commissions: commissionsWithDetails
    });
    
  } catch (error) {
    logger.error({
      message: `Error retrieving sales rep commissions: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "sales_rep",
      metadata: {
        salesRepId: req.params.id,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve sales representative commissions"
    });
  }
});

/**
 * POST /sales-reps/:id/commissions
 * Create a new commission record
 */
router.post("/:id/commissions", async (req: Request, res: Response) => {
  try {
    const salesRepId = parseInt(req.params.id);
    if (isNaN(salesRepId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sales rep ID"
      });
    }
    
    // Verify the sales rep exists
    const salesRep = await storage.getSalesRep(salesRepId);
    if (!salesRep) {
      return res.status(404).json({
        success: false,
        message: "Sales rep not found"
      });
    }
    
    const data = createCommissionSchema.parse({
      ...req.body,
      salesRepId
    });
    
    // Verify the contract exists
    const contract = await storage.getContract(data.contractId);
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Contract not found"
      });
    }
    
    // Calculate commission if not provided
    if (!data.amount || data.amount <= 0) {
      // Calculate commission based on contract amount and sales rep's rate
      if (salesRep.commissionRate && contract.amount) {
        if (salesRep.commissionRateType === 'percentage') {
          data.amount = (contract.amount * salesRep.commissionRate) / 100;
        } else {
          data.amount = salesRep.commissionRate;
        }
      } else {
        return res.status(400).json({
          success: false,
          message: "Commission amount is required when sales rep doesn't have a default rate"
        });
      }
    }
    
    // Create the commission
    const commission = await storage.createCommission({
      salesRepId: data.salesRepId,
      contractId: data.contractId,
      amount: data.amount,
      rate: data.rate,
      rateType: data.rateType,
      status: data.status || 'pending',
      notes: data.notes
    });
    
    logger.info({
      message: `Created commission of $${data.amount} for sales rep ${salesRepId} on contract ${data.contractId}`,
      category: "api",
      source: "commission",
      metadata: {
        salesRepId,
        contractId: data.contractId,
        amount: data.amount,
        status: data.status || 'pending'
      }
    });
    
    // Update sales rep analytics
    await salesRepAnalyticsService.updateAnalyticsForSalesRep(salesRepId);
    
    return res.status(201).json({
      success: true,
      commission
    });
    
  } catch (error) {
    if (error instanceof ZodError) {
      const formattedError = fromZodError(error);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: formattedError.details
      });
    }
    
    logger.error({
      message: `Error creating commission: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "commission",
      metadata: {
        salesRepId: req.params.id,
        body: req.body,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to create commission"
    });
  }
});

/**
 * PATCH /sales-reps/commissions/:id
 * Update a commission record
 */
router.patch("/commissions/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid commission ID"
      });
    }
    
    const data = updateCommissionSchema.parse(req.body);
    
    // Verify the commission exists
    const commission = await storage.getCommission(id);
    if (!commission) {
      return res.status(404).json({
        success: false,
        message: "Commission not found"
      });
    }
    
    // If marking as paid, set paidAt if not provided
    if (data.status === 'paid' && !data.paidAt) {
      data.paidAt = new Date();
    }
    
    // Update the commission
    const updatedCommission = await storage.updateCommission(id, data);
    
    // Update sales rep analytics
    await salesRepAnalyticsService.updateAnalyticsForSalesRep(commission.salesRepId);
    
    return res.json({
      success: true,
      commission: updatedCommission
    });
    
  } catch (error) {
    if (error instanceof ZodError) {
      const formattedError = fromZodError(error);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: formattedError.details
      });
    }
    
    logger.error({
      message: `Error updating commission: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "commission",
      metadata: {
        commissionId: req.params.id,
        body: req.body,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to update commission"
    });
  }
});

/**
 * GET /sales-reps/:id/analytics
 * Get analytics for a sales rep
 */
router.get("/:id/analytics", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sales rep ID"
      });
    }
    
    // Verify the sales rep exists
    const salesRep = await storage.getSalesRep(id);
    if (!salesRep) {
      return res.status(404).json({
        success: false,
        message: "Sales rep not found"
      });
    }
    
    // Get analytics
    const analytics = await storage.getSalesRepAnalyticsBySalesRepId(id);
    
    // Get detailed performance report
    const performanceReport = await salesRepAnalyticsService.generatePerformanceReport(id);
    
    return res.json({
      success: true,
      analytics,
      performanceReport
    });
    
  } catch (error) {
    logger.error({
      message: `Error retrieving sales rep analytics: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "sales_rep",
      metadata: {
        salesRepId: req.params.id,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve sales representative analytics"
    });
  }
});

/**
 * POST /sales-reps/:id/refresh-analytics
 * Manually trigger analytics update for a sales rep
 */
router.post("/:id/refresh-analytics", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid sales rep ID"
      });
    }
    
    // Verify the sales rep exists
    const salesRep = await storage.getSalesRep(id);
    if (!salesRep) {
      return res.status(404).json({
        success: false,
        message: "Sales rep not found"
      });
    }
    
    // Update analytics
    await salesRepAnalyticsService.updateAnalyticsForSalesRep(id);
    
    // Get updated analytics
    const analytics = await storage.getSalesRepAnalyticsBySalesRepId(id);
    
    return res.json({
      success: true,
      message: "Sales rep analytics refreshed",
      analytics: analytics[0] // Return the most recent analytics
    });
    
  } catch (error) {
    logger.error({
      message: `Error refreshing sales rep analytics: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "sales_rep",
      metadata: {
        salesRepId: req.params.id,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to refresh sales representative analytics"
    });
  }
});

/**
 * POST /sales-reps/create-with-user
 * Create a new user and register them as a sales rep in one step
 */
const createUserSalesRepSchema = z.object({
  // User data
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  
  // Sales rep data
  merchantId: z.number(),
  title: z.string().optional(),
  commissionRate: z.number().optional(),
  commissionRateType: z.enum(["percentage", "fixed"]).optional(),
  maxAllowedFinanceAmount: z.number().optional(),
  target: z.number().optional(),
  notes: z.string().optional()
});

router.post("/create-with-user", async (req: Request, res: Response) => {
  try {
    const data = createUserSalesRepSchema.parse(req.body);
    
    // Verify the merchant exists
    const merchant = await storage.getMerchant(data.merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found"
      });
    }
    
    // Check if user with email already exists
    const existingUser = await storage.getUserByEmail(data.email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists"
      });
    }
    
    // Start a transaction to ensure both operations (create user and create sales rep) succeed or fail together
    const userData = {
      email: data.email,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      // Set role to sales_rep directly
      role: "sales_rep" as const
    };
    
    // Create the user
    logger.info({
      message: `Creating new user for sales rep: ${data.email}`,
      category: "api",
      source: "internal"
    });
    
    const newUser = await storage.createUser(userData);
    
    // Create the sales rep record
    const salesRepData = {
      userId: newUser.id,
      merchantId: data.merchantId,
      title: data.title,
      commissionRate: data.commissionRate,
      commissionRateType: data.commissionRateType,
      maxAllowedFinanceAmount: data.maxAllowedFinanceAmount,
      target: data.target,
      notes: data.notes,
      active: true
    };
    
    const salesRep = await storage.createSalesRep(salesRepData);
    
    // Initialize analytics for the new sales rep
    await salesRepAnalyticsService.updateAnalyticsForSalesRep(salesRep.id);
    
    // Create log for complete sales rep creation
    await storage.createLog({
      level: "info",
      message: `Sales rep created with new user: ${newUser.email}`,
      userId: newUser.id,
      metadata: JSON.stringify({ 
        salesRepId: salesRep.id, 
        merchantId: data.merchantId 
      }),
    });
    
    // Remove password from response
    const { password, ...userWithoutPassword } = newUser;
    
    return res.status(201).json({
      success: true,
      user: userWithoutPassword,
      salesRep
    });
    
  } catch (error) {
    if (error instanceof ZodError) {
      const formattedError = fromZodError(error);
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: formattedError.details
      });
    }
    
    logger.error({
      message: `Error creating user and sales rep: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        body: req.body,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to create sales representative with user"
    });
  }
});

export default router;