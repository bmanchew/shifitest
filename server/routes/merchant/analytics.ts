import { Request, Response } from "express";
import { storage } from "../../storage";
import { logger } from "../../services/logger";
import { merchantAnalyticsService } from "../../services";

/**
 * Get performance analytics for a merchant
 */
export async function getMerchantAnalytics(req: Request, res: Response) {
  try {
    const merchantId = parseInt(req.params.id);
    
    if (isNaN(merchantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid merchant ID"
      });
    }
    
    // Check if the merchant exists
    const merchant = await storage.getMerchant(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found"
      });
    }
    
    // Get merchant performance by calling the service directly
    const performance = await merchantAnalyticsService.getMerchantPerformance(merchantId);
    
    // If we have performance data, format and return it
    if (performance) {
      return res.status(200).json({
        success: true,
        data: performance
      });
    }
    
    // If no performance data exists, calculate metrics on the fly
    logger.info({
      message: `No performance record found for merchant ${merchantId}, calculating on the fly`,
      category: "api",
      source: "analytics",
      metadata: { merchantId }
    });
    
    // Calculate metrics and update merchant performance
    const updatedPerformance = await merchantAnalyticsService.updateMerchantPerformance(merchantId);
    
    // Return the calculated performance data
    return res.status(200).json({
      success: true,
      data: updatedPerformance
    });
  } catch (error) {
    logger.error({
      message: `Failed to fetch merchant analytics: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "analytics",
      metadata: {
        merchantId: req.params.id,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to fetch merchant analytics"
    });
  }
}

/**
 * Get contract summary for a merchant
 */
export async function getContractSummary(req: Request, res: Response) {
  try {
    const merchantId = parseInt(req.params.id);
    
    if (isNaN(merchantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid merchant ID"
      });
    }
    
    // Check if the merchant exists
    const merchant = await storage.getMerchant(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found"
      });
    }
    
    const analytics = await merchantAnalyticsService.getContractSummary(merchantId);
    
    return res.status(200).json({
      success: true,
      data: analytics
    });
  } catch (error) {
    logger.error({
      message: 'Error fetching merchant contract summary',
      category: "api",
      source: "analytics",
      metadata: { 
        merchantId: req.params.id,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      }
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve merchant contract summary'
    });
  }
}

/**
 * Get merchant contracts
 */
export async function getMerchantContracts(req: Request, res: Response) {
  try {
    const merchantId = parseInt(req.params.id);
    
    if (isNaN(merchantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid merchant ID"
      });
    }
    
    // Check if the merchant exists
    const merchant = await storage.getMerchant(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found"
      });
    }
    
    const contracts = await storage.getContractsByMerchantId(merchantId);
    
    return res.status(200).json({
      success: true,
      data: contracts
    });
  } catch (error) {
    logger.error({
      message: 'Error fetching merchant contracts',
      category: "api",
      source: "analytics",
      metadata: { 
        merchantId: req.params.id,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      }
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve merchant contracts'
    });
  }
}