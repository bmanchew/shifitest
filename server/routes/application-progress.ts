import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { storage } from '../storage';
import { logger } from '../services/logger';

// Create a router with strict path pattern matching
const applicationProgressRouter = express.Router({
  strict: true,
  caseSensitive: true
});

// Apply authentication to all routes in this router
applicationProgressRouter.use(authenticateToken);

/**
 * Get application progress for all contracts
 */
applicationProgressRouter.get("/", async (req: Request, res: Response) => {
  try {
    // Get user info from auth middleware
    const { role, id } = req.user || {};
    
    // If user is an admin, retrieve all application progress
    if (role === 'admin') {
      const progress = await storage.getAllApplicationProgress();
      return res.status(200).json({
        success: true,
        data: progress
      });
    }
    
    // Get merchant ID from user ID
    const merchant = await storage.getMerchantByUserId(id);
    
    if (!merchant) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to access application progress"
      });
    }
    
    // Get contracts for this merchant
    const contracts = await storage.getContractsByMerchantId(merchant.id);
    
    if (!contracts || contracts.length === 0) {
      return res.status(200).json({
        success: true,
        data: []
      });
    }
    
    // Get application progress for each contract
    const progressPromises = contracts.map(contract => 
      storage.getApplicationProgressByContractId(contract.id)
    );
    
    const progressResults = await Promise.all(progressPromises);
    
    // Flatten the results
    const allProgress = progressResults.flat().filter(Boolean);
    
    return res.status(200).json({
      success: true,
      data: allProgress
    });
  } catch (error) {
    logger.error({
      message: `Error fetching application progress: ${error}`,
      category: 'api',
      source: 'internal',
      metadata: { error }
    });
    
    return res.status(500).json({
      success: false,
      error: "Failed to fetch application progress"
    });
  }
});

/**
 * Create a new application progress record
 */
applicationProgressRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { role, id } = req.user || {};
    const { merchantId, contractId, step, completed, metadata } = req.body;
    
    // Verify permissions
    if (role !== 'admin') {
      const merchant = await storage.getMerchantByUserId(id);
      
      if (!merchant || merchant.id !== merchantId) {
        return res.status(403).json({
          success: false,
          error: "Not authorized to create application progress"
        });
      }
      
      // Check if contract belongs to the merchant
      const contract = await storage.getContract(contractId);
      
      if (!contract || contract.merchantId !== merchant.id) {
        return res.status(403).json({
          success: false,
          error: "Not authorized to create application progress for this contract"
        });
      }
    }
    
    // Create a new application progress record
    const progressData = {
      merchantId,
      step,
      completed: completed || false,
      metadata
    };
    
    const progress = await storage.createApplicationProgress(progressData);
    
    return res.status(201).json({
      success: true,
      data: progress
    });
  } catch (error) {
    logger.error({
      message: `Error creating application progress: ${error}`,
      category: 'api',
      source: 'internal',
      metadata: { error, body: req.body }
    });
    
    return res.status(500).json({
      success: false,
      error: "Failed to create application progress"
    });
  }
});

/**
 * Update an existing application progress record
 */
applicationProgressRouter.patch("/:id", async (req: Request, res: Response) => {
  try {
    const progressId = parseInt(req.params.id, 10);
    const { role, id } = req.user || {};
    const { completed, metadata } = req.body;
    
    // Get the existing progress record
    const existingProgress = await storage.getApplicationProgressById(progressId);
    
    if (!existingProgress) {
      return res.status(404).json({
        success: false,
        error: "Application progress not found"
      });
    }
    
    // Verify permissions
    if (role !== 'admin') {
      const merchant = await storage.getMerchantByUserId(id);
      
      if (!merchant || merchant.id !== existingProgress.merchantId) {
        return res.status(403).json({
          success: false,
          error: "Not authorized to update application progress"
        });
      }
    }
    
    // Update the progress record
    const updateData = {
      ...existingProgress,
      completed: completed !== undefined ? completed : existingProgress.completed,
      metadata: metadata || existingProgress.metadata,
      completedAt: completed ? new Date() : existingProgress.completedAt
    };
    
    const updatedProgress = await storage.updateApplicationProgress(progressId, updateData);
    
    return res.status(200).json({
      success: true,
      data: updatedProgress
    });
  } catch (error) {
    logger.error({
      message: `Error updating application progress: ${error}`,
      category: 'api',
      source: 'internal',
      metadata: { error, progressId: req.params.id, body: req.body }
    });
    
    return res.status(500).json({
      success: false,
      error: "Failed to update application progress"
    });
  }
});

/**
 * Get application progress for a specific contract
 */
applicationProgressRouter.get("/kyc/:contractId", async (req: Request, res: Response) => {
  try {
    const contractId = parseInt(req.params.contractId, 10);
    const { role, id } = req.user || {};
    
    // Get the contract to verify ownership
    const contract = await storage.getContract(contractId);
    
    if (!contract) {
      return res.status(404).json({
        success: false,
        error: "Contract not found"
      });
    }
    
    // Verify permissions
    if (role !== 'admin') {
      const merchant = await storage.getMerchantByUserId(id);
      
      if (!merchant || merchant.id !== contract.merchantId) {
        return res.status(403).json({
          success: false,
          error: "Not authorized to access this contract's application progress"
        });
      }
    }
    
    // Get application progress for the contract
    const progress = await storage.getApplicationProgressByContractId(contractId);
    
    return res.status(200).json({
      success: true,
      data: progress
    });
  } catch (error) {
    logger.error({
      message: `Error fetching contract application progress: ${error}`,
      category: 'api',
      source: 'internal',
      metadata: { error, contractId: req.params.contractId }
    });
    
    return res.status(500).json({
      success: false,
      error: "Failed to fetch contract application progress"
    });
  }
});

export default applicationProgressRouter;