import express, { Request, Response } from "express";
import { storage } from "../../storage";
import { authenticateToken } from "../../middleware/auth";
import { logger } from "../../services/logger";

const router = express.Router();

/**
 * Get sales representatives for a merchant
 * Provides a list of sales reps with performance data 
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    // Only allow admin or the correct merchant user
    const isAdmin = req.user?.role === 'admin';
    const merchantId = parseInt(req.query.merchantId as string);
    
    if (isNaN(merchantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid merchant ID parameter"
      });
    }
    
    // Validate permissions - either admin or merchant accessing own data
    if (!isAdmin && req.user?.merchantId !== merchantId) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to access this merchant's data"
      });
    }
    
    // Get merchant to validate existence
    const merchant = await storage.getMerchant(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found"
      });
    }

    // Get sales reps associated with this merchant
    const salesReps = await storage.getSalesRepsByMerchant(merchantId);
    if (!salesReps || salesReps.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: "No sales representatives found for this merchant"
      });
    }
    
    // Get contracts for additional performance data
    const contracts = await storage.getContractsByMerchantId(merchantId);
    
    // Build sales rep performance data
    const salesRepPerformance = await Promise.all(salesReps.map(async (rep) => {
      // Find contracts handled by this sales rep
      const repContracts = contracts.filter(c => c.salesRepId === rep.id);
      
      // Calculate key metrics
      const totalContracts = repContracts.length;
      const activeContracts = repContracts.filter(c => c.status === 'active').length;
      const completedContracts = repContracts.filter(c => c.status === 'completed').length;
      
      // Get total funding amount
      const totalFunding = repContracts.reduce((sum, contract) => {
        return sum + (contract.totalAmount || 0);
      }, 0);
      
      // Optional: Get user details for the sales rep
      const user = await storage.getUser(rep.userId);
      
      return {
        id: rep.id,
        name: user?.name || `Sales Rep #${rep.id}`,
        email: user?.email || "N/A",
        phone: user?.phone || "N/A",
        performanceData: {
          totalContracts,
          activeContracts,
          completedContracts,
          totalFunding,
          conversionRate: totalContracts > 0 ? (completedContracts / totalContracts) * 100 : 0
        }
      };
    }));
    
    return res.json({
      success: true,
      data: salesRepPerformance
    });
    
  } catch (error) {
    logger.error({
      message: `Error fetching sales rep data: ${error instanceof Error ? error.message : String(error)}`,
      category: "api", 
      source: "internal",
      userId: req.user?.id,
      metadata: {
        merchantId: req.query.merchantId,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve sales representatives data"
    });
  }
});

export default router;