
import { Request, Response } from "express";
import { storage } from "../../storage";
import { logger } from "../../services/logger";
import { merchantAnalyticsService } from "../../services";

// Get all merchant performances for the dashboard
export async function getAllMerchantPerformances(req: Request, res: Response) {
  try {
    // Get all merchant performances from the database
    const merchantPerformances = await storage.getAllMerchantPerformances();
    
    // Return the data
    return res.status(200).json({
      success: true,
      data: merchantPerformances
    });
  } catch (error) {
    logger.error({
      message: `Failed to fetch merchant performances: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "analytics",
      metadata: {
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to fetch merchant performances"
    });
  }
}

// Get detailed performance for a specific merchant
export async function getMerchantPerformanceDetails(req: Request, res: Response) {
  try {
    const merchantId = parseInt(req.params.id);
    
    if (isNaN(merchantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid merchant ID"
      });
    }
    
    // Get merchant details
    const merchant = await storage.getMerchant(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found"
      });
    }
    
    // Get merchant performance from the database
    const performance = await storage.getMerchantPerformance(merchantId);
    
    // If performance record doesn't exist, calculate it on the fly
    if (!performance) {
      // Calculate metrics
      const metrics = await merchantAnalyticsService.calculateMerchantMetrics(merchantId);
      const performanceScore = merchantAnalyticsService.calculatePerformanceScore(metrics);
      const grade = merchantAnalyticsService.scoreToGrade(performanceScore);
      
      // Return calculated data
      return res.status(200).json({
        success: true,
        data: {
          merchantId,
          merchantName: merchant.name,
          performanceScore,
          grade,
          metrics,
          // No recommendations without stored data
          recommendations: []
        }
      });
    }
    
    // Get contracts for additional context
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
        contractsData: contracts.map(contract => ({
          id: contract.id,
          contractNumber: contract.contractNumber,
          amount: contract.amount,
          status: contract.status,
          currentStep: contract.currentStep,
          createdAt: contract.createdAt
        })),
        lastUpdated: performance.lastUpdated
      }
    });
  } catch (error) {
    logger.error({
      message: `Failed to fetch merchant performance details: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "analytics",
      metadata: {
        merchantId: req.params.id,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to fetch merchant performance details"
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
    // Get all merchants
    const merchants = await storage.getAllMerchants();
    
    // Track success and failures
    const results = {
      total: merchants.length,
      success: 0,
      failed: 0,
      merchantsUpdated: [] as number[],
      errors: [] as {merchantId: number, error: string}[]
    };
    
    // Update each merchant's performance
    for (const merchant of merchants) {
      try {
        await merchantAnalyticsService.updateMerchantPerformance(merchant.id);
        results.success++;
        results.merchantsUpdated.push(merchant.id);
      } catch (merchantError) {
        results.failed++;
        results.errors.push({
          merchantId: merchant.id,
          error: merchantError instanceof Error ? merchantError.message : String(merchantError)
        });
        
        logger.error({
          message: `Failed to update merchant ${merchant.id} performance: ${merchantError instanceof Error ? merchantError.message : String(merchantError)}`,
          category: "api",
          source: "analytics",
          metadata: {
            merchantId: merchant.id,
            error: merchantError instanceof Error ? merchantError.stack : String(merchantError)
          }
        });
      }
    }
    
    return res.status(200).json({
      success: true,
      message: `Successfully updated ${results.success} out of ${results.total} merchant performances`,
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
