import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { storage } from '../storage';
import { logger } from '../services/logger';
import { merchantAnalyticsService } from '../services';

const router = express.Router();

/**
 * Get merchant analytics data
 * This endpoint provides performance metrics and analytics for a specific merchant
 */
router.get('/:merchantId/analytics', authenticateToken, async (req: Request, res: Response) => {
  console.log(`Analytics request received for merchant ID: ${req.params.merchantId}`);
  try {
    const merchantId = parseInt(req.params.merchantId);
    
    if (isNaN(merchantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid merchant ID format"
      });
    }
    
    // Ensure the request is coming from the merchant or an admin
    const isRequestingOwnData = req.user?.merchantId === merchantId;
    const isAdminUser = req.user?.role === 'admin';
    
    if (!isRequestingOwnData && !isAdminUser) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to access this merchant's data"
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
    
    // Get merchant performance data
    const performanceData = await merchantAnalyticsService.getMerchantPerformance(merchantId);
    
    // If no performance data exists, calculate it on-the-fly
    if (!performanceData) {
      logger.info({
        message: `No performance data found for merchant ${merchantId}, calculating on the fly`,
        category: 'api',
        source: 'internal',
        userId: req.user?.id,
        metadata: { merchantId }
      });
      
      // Calculate and update merchant performance
      const updatedPerformance = await merchantAnalyticsService.updateMerchantPerformance(merchantId);
      
      return res.json({
        success: true,
        score: updatedPerformance?.score || 0,
        grade: updatedPerformance?.grade || 'N/A',
        metrics: updatedPerformance?.metrics || {
          defaultRate: 0,
          latePaymentRate: 0,
          avgContractValue: 0,
          totalContracts: 0,
          activeContracts: 0,
          completedContracts: 0,
          cancelledContracts: 0,
          riskAdjustedReturn: 0,
          customerSatisfactionScore: 0
        }
      });
    }
    
    // Return performance data
    return res.json({
      success: true,
      score: performanceData.score || 0,
      grade: performanceData.grade || 'N/A',
      metrics: performanceData.metrics || {
        defaultRate: 0,
        latePaymentRate: 0,
        avgContractValue: 0,
        totalContracts: 0,
        activeContracts: 0,
        completedContracts: 0,
        cancelledContracts: 0,
        riskAdjustedReturn: 0,
        customerSatisfactionScore: 0
      }
    });
  } catch (error) {
    logger.error({
      message: `Error fetching merchant analytics: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'internal',
      userId: req.user?.id,
      metadata: {
        merchantId: req.params.merchantId,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve merchant analytics"
    });
  }
});

export default router;