import express, { Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { storage } from '../storage';
import { logger } from '../services/logger';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * Get sales representatives for a merchant
 * Provides a list of sales reps with performance data 
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { merchantId } = req.query;
    
    if (!merchantId) {
      return res.status(400).json({
        success: false,
        message: "Merchant ID is required"
      });
    }
    
    const merchantIdNum = parseInt(merchantId as string);
    
    if (isNaN(merchantIdNum)) {
      return res.status(400).json({
        success: false,
        message: "Invalid merchant ID format"
      });
    }
    
    // Ensure the request is coming from the merchant or an admin
    const isRequestingOwnData = req.user?.merchantId === merchantIdNum;
    const isAdminUser = req.user?.role === 'admin';
    
    if (!isRequestingOwnData && !isAdminUser) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to access this merchant's sales rep data"
      });
    }
    
    // Check if the merchant exists
    const merchant = await storage.getMerchant(merchantIdNum);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found"
      });
    }
    
    // Fetch contracts to calculate sales rep performance
    const contracts = await storage.getContractsByMerchantId(merchantIdNum);
    
    // Extract and deduplicate sales rep info from contracts
    const salesRepsMap = new Map();
    
    contracts.forEach(contract => {
      if (contract.salesRepId && contract.salesRepName) {
        if (!salesRepsMap.has(contract.salesRepId)) {
          salesRepsMap.set(contract.salesRepId, {
            id: contract.salesRepId,
            name: contract.salesRepName,
            email: contract.salesRepEmail || '',
            phone: contract.salesRepPhone || '',
            totalContracts: 0,
            activeContracts: 0,
            totalValue: 0,
            conversionRate: 0,
            avgContractValue: 0
          });
        }
        
        const salesRep = salesRepsMap.get(contract.salesRepId);
        salesRep.totalContracts++;
        
        if (contract.status === 'active') {
          salesRep.activeContracts++;
        }
        
        salesRep.totalValue += contract.amount || 0;
      }
    });
    
    // Calculate derived metrics for each sales rep
    const salesReps = Array.from(salesRepsMap.values()).map(rep => {
      rep.avgContractValue = rep.totalContracts > 0 ? rep.totalValue / rep.totalContracts : 0;
      rep.conversionRate = rep.totalContracts > 0 ? (rep.activeContracts / rep.totalContracts) * 100 : 0;
      return rep;
    });
    
    // Sort by total value in descending order
    salesReps.sort((a, b) => b.totalValue - a.totalValue);
    
    return res.json(salesReps);
  } catch (error) {
    logger.error({
      message: `Error fetching sales reps: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'internal',
      userId: req.user?.id,
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

export default router;