import express, { Request, Response } from "express";
import { storage } from "../../storage";
import { authenticateToken } from "../../middleware/auth";
import { logger } from "../../services/logger";

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
    
    // Users can only see their own merchant's analytics unless they're an admin
    const isAdminUser = req.user?.role === 'admin';
    
    if (!isAdminUser && req.user?.merchantId !== merchantId) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view this merchant's analytics"
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
    
    // Get merchant performance data
    const merchantPerformance = await storage.getMerchantPerformance(merchantId);
    
    // Get contracts for the merchant for additional analytics
    const contracts = await storage.getContractsByMerchantId(merchantId);
    
    // Calculate active contracts
    const activeContracts = contracts.filter(c => c.status === 'active').length;
    const totalContracts = contracts.length;
    const completedContracts = contracts.filter(c => c.status === 'completed').length;
    
    // Calculate total funding amount
    const totalFunding = contracts.reduce((sum, contract) => {
      return sum + (contract.totalAmount || 0);
    }, 0);
    
    // Calculate monthly trends (last 6 months)
    const now = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(now.getMonth() - 6);
    
    // Filter contracts created in the last 6 months
    const recentContracts = contracts.filter(contract => {
      if (!contract.createdAt) return false;
      const createdDate = new Date(contract.createdAt);
      return createdDate >= sixMonthsAgo;
    });
    
    // Group contracts by month
    const monthlyData: Record<string, { contracts: number, funding: number }> = {};
    
    for (let i = 0; i < 6; i++) {
      const monthDate = new Date();
      monthDate.setMonth(now.getMonth() - i);
      const monthKey = `${monthDate.getFullYear()}-${monthDate.getMonth() + 1}`;
      monthlyData[monthKey] = { contracts: 0, funding: 0 };
    }
    
    recentContracts.forEach(contract => {
      if (!contract.createdAt) return;
      const createdDate = new Date(contract.createdAt);
      const monthKey = `${createdDate.getFullYear()}-${createdDate.getMonth() + 1}`;
      
      if (monthlyData[monthKey]) {
        monthlyData[monthKey].contracts++;
        monthlyData[monthKey].funding += contract.totalAmount || 0;
      }
    });
    
    // Convert monthly data to arrays for easier frontend consumption
    const monthlyTrends = Object.entries(monthlyData).map(([month, data]) => ({
      month,
      contracts: data.contracts,
      funding: data.funding
    })).sort((a, b) => {
      // Sort by month ascending
      return a.month.localeCompare(b.month);
    });
    
    // Build response data
    const analyticsData = {
      merchantName: merchant.name,
      performanceMetrics: merchantPerformance ? {
        performanceScore: merchantPerformance.performanceScore,
        grade: merchantPerformance.grade,
        defaultRate: merchantPerformance.defaultRate || 0,
        latePaymentRate: merchantPerformance.latePaymentRate || 0,
        avgContractValue: merchantPerformance.avgContractValue || 0,
        totalFunding: merchantPerformance.totalFunding || 0,
        activeCustomers: merchantPerformance.activeCustomers || 0
      } : null,
      contractStats: {
        activeContracts,
        totalContracts,
        completedContracts,
        totalFunding
      },
      monthlyTrends
    };
    
    return res.json({
      success: true,
      data: analyticsData
    });
    
  } catch (error) {
    logger.error({
      message: `Error fetching merchant analytics: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
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