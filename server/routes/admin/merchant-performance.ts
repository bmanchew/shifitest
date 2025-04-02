import { Request, Response } from "express";
import { logger } from "../../services/logger";
import { storage } from "../../storage";
import { merchantAnalyticsService } from "../../services";

// Get all merchant performances
export async function getAllMerchantPerformances(req: Request, res: Response) {
  try {
    // Get all merchant performances using the service
    const performances = await merchantAnalyticsService.getAllMerchantPerformances();

    // Return performances data directly as an array, matching client expectations
    return res.status(200).json(performances);
  } catch (error) {
    logger.error({
      message: `Failed to get merchant performances: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "analytics",
      metadata: {
        error: error instanceof Error ? error.stack : String(error)
      }
    });

    return res.status(500).json({
      success: false,
      message: "Failed to get merchant performances"
    });
  }
}

// Get detailed performance for a merchant
export async function getMerchantPerformanceDetails(req: Request, res: Response) {
  try {
    const merchantId = parseInt(req.params.id);

    if (isNaN(merchantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid merchant ID"
      });
    }

    // Get the merchant
    const merchant = await storage.getMerchant(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found"
      });
    }

    // Get performance data using the service
    const performance = await merchantAnalyticsService.getMerchantPerformance(merchantId);
    if (!performance) {
      return res.status(404).json({
        success: false,
        message: "Performance data not found"
      });
    }

    const contracts = await storage.getContractsByMerchantId(merchantId);

    // Parse underwriting recommendations if available
    let recommendations = [];
    try {
      if (performance.underwritingRecommendations) {
        recommendations = JSON.parse(performance.underwritingRecommendations);
      }
    } catch (parseError) {
      logger.warn({
        message: `Failed to parse underwriting recommendations: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        category: "api",
        source: "analytics",
        metadata: { merchantId }
      });
    }

    // Return the detailed performance data structured to match client expectations
    // Instead of nesting under data, return the full object directly
    return res.status(200).json({
      merchantId,
      merchantName: merchant.name,
      performanceScore: performance.performanceScore,
      grade: performance.grade,
      defaultRate: performance.defaultRate || 0,
      latePaymentRate: performance.latePaymentRate || 0,
      avgContractValue: performance.avgContractValue || 0,
      totalContracts: performance.totalContracts || 0,
      activeContracts: performance.activeContracts || 0,
      completedContracts: performance.completedContracts || 0,
      cancelledContracts: performance.cancelledContracts || 0,
      riskAdjustedReturn: performance.riskAdjustedReturn || 0,
      customerSatisfactionScore: performance.customerSatisfactionScore || 0,
      underwritingRecommendations: performance.underwritingRecommendations,
      recommendations,
      contracts
    });
  } catch (error) {
    logger.error({
      message: `Failed to get merchant performance details: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "analytics",
      metadata: {
        merchantId: req.params.id,
        error: error instanceof Error ? error.stack : String(error)
      }
    });

    return res.status(500).json({
      success: false,
      message: "Failed to get merchant performance details"
    });
  }
}

// Update performance metrics for a specific merchant
export async function updateMerchantPerformance(req: Request, res: Response) {
  try {
    const merchantId = parseInt(req.params.id);

    if (isNaN(merchantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid merchant ID"
      });
    }

    // Update merchant performance using the service
    await merchantAnalyticsService.updateMerchantPerformance(merchantId);

    // Get the updated performance using the service
    const updatedPerformance = await merchantAnalyticsService.getMerchantPerformance(merchantId);

    // Return the performance data directly, matching client expectations
    return res.status(200).json(updatedPerformance);
  } catch (error) {
    logger.error({
      message: `Failed to update merchant performance: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "analytics",
      metadata: {
        merchantId: req.params.id,
        error: error instanceof Error ? error.stack : String(error)
      }
    });

    return res.status(500).json({
      success: false,
      message: "Failed to update merchant performance"
    });
  }
}

// Update all merchant performances
export async function updateAllMerchantPerformances(req: Request, res: Response) {
  try {
    const results = await merchantAnalyticsService.updateAllMerchantPerformances();
    
    // After updating, get the most recent performance data
    const performances = await merchantAnalyticsService.getAllMerchantPerformances();

    // Return the array of performances directly to match client expectations
    return res.status(200).json(performances);
  } catch (error) {
    logger.error({
      message: `Failed to update all merchant performances: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "analytics",
      metadata: {
        error: error instanceof Error ? error.stack : String(error)
      }
    });

    return res.status(500).json({
      success: false,
      message: "Failed to update all merchant performances"
    });
  }
}