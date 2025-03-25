
import { Request, Response } from "express";
import { storage } from "../../storage";
import { logger } from "../../services/logger";
import { merchantAnalyticsService } from "../../services";

// Get performance analytics for a merchant
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
    
    // Get merchant performance from the database
    let performance = await storage.getMerchantPerformance(merchantId);
    
    // If no performance record exists, create one on the fly
    if (!performance) {
      logger.info({
        message: `No performance record found for merchant ${merchantId}, calculating on the fly`,
        category: "api",
        source: "analytics",
        metadata: { merchantId }
      });
      
      // Calculate metrics
      const metrics = await merchantAnalyticsService.calculateMerchantMetrics(merchantId);
      const performanceScore = merchantAnalyticsService.calculatePerformanceScore(metrics);
      const grade = merchantAnalyticsService.scoreToGrade(performanceScore);
      
      // Return calculated performance data
      return res.status(200).json({
        success: true,
        score: performanceScore,
        grade,
        metrics
      });
    }
    
    // Return the performance data
    return res.status(200).json({
      success: true,
      score: performance.performanceScore,
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
      lastUpdated: performance.lastUpdated
    });
  } catch (error) {
    logger.error({
      message: `Failed to fetch merchant analytics: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "analytics",
      metadata: {
        merchantId: req.params.id,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to fetch merchant analytics"
    });
  }
}
