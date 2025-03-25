import { Request, Response } from "express";
import { logger } from "../../services/logger";
import { storage } from "../../storage";
import { merchantAnalyticsService } from "../../services";

// Get all merchant performances
export async function getAllMerchantPerformances(req: Request, res: Response) {
  try {
    // Get all merchant performances
    const performances = await storage.getAllMerchantPerformances();

    // Return performances data
    return res.status(200).json({
      success: true,
      data: performances
    });
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

    // Get performance data
    const performance = await storage.getMerchantPerformance(merchantId);
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

    // Return detailed performance data
    return res.status(200).json({
      success: true,
      data: {
        merchantId,
        merchantName: merchant.name,
        performanceScore: performance.performanceScore,
        grade: performance.grade,
        metrics: {
          defaultRate: performance.defaultRate || 0,
          latePaymentRate: performance.latePaymentRate || 0,
          avgContractValue: performance.avgContractValue || 0,
          totalContracts: performance.totalContracts || 0,
          activeContracts: performance.activeContracts || 0,
          completedContracts: performance.completedContracts || 0,
          cancelledContracts: performance.cancelledContracts || 0,
          riskAdjustedReturn: performance.riskAdjustedReturn || 0,
          customerSatisfactionScore: performance.customerSatisfactionScore || 0
        },
        recommendations,
        contracts
      }
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

    // Get the updated performance
    const updatedPerformance = await storage.getMerchantPerformance(merchantId);

    return res.status(200).json({
      success: true,
      message: "Merchant performance updated successfully",
      data: updatedPerformance
    });
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

    return res.status(200).json({
      success: true,
      message: "All merchant performances updated successfully",
      data: results
    });
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