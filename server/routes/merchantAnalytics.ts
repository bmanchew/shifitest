
import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { logger } from "../services/logger";
import jwt from "jsonwebtoken";

// Copy of authentication middleware from routes.ts to avoid circular dependency
const authenticateToken = (req: Request, res: Response, next: Function) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: "Authentication token is required" });
  }

  const secret = process.env.JWT_SECRET || 'default_secret_key_for_development';
  
  jwt.verify(token, secret, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ message: "Invalid or expired token" });
    }
    
    (req as any).user = user;
    next();
  });
};

// Admin role middleware
const isAdmin = (req: Request, res: Response, next: Function) => {
  if ((req as any).user && (req as any).user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: "Access denied: Admin role required" });
  }
};

// Merchant role middleware
const isMerchantUser = (req: Request, res: Response, next: Function) => {
  if ((req as any).user && (req as any).user.role === 'merchant') {
    next();
  } else {
    res.status(403).json({ message: "Access denied: Merchant role required" });
  }
};

// Create a service for merchant analytics if it doesn't exist
const merchantAnalyticsService = {
  async getContractSummary(merchantId: number) {
    try {
      const contracts = await storage.getContractsByMerchantId(merchantId);
      
      // Calculate summary statistics
      const total = contracts.length;
      const active = contracts.filter(c => c.status === 'active').length;
      const pending = contracts.filter(c => c.status === 'pending').length;
      const completed = contracts.filter(c => c.status === 'completed').length;
      const declined = contracts.filter(c => c.status === 'declined').length;
      
      // Calculate total financing amount
      const totalAmount = contracts.reduce((sum, contract) => sum + (contract.amount || 0), 0);
      const activeAmount = contracts
        .filter(c => c.status === 'active')
        .reduce((sum, contract) => sum + (contract.amount || 0), 0);
      
      return {
        total,
        active,
        pending,
        completed,
        declined,
        totalAmount,
        activeAmount
      };
    } catch (error) {
      logger.error({
        message: `Error getting merchant analytics`,
        error,
        metadata: { merchantId }
      });
      throw error;
    }
  }
};

const router = Router();

// Route to get merchant analytics
router.get('/merchant/:merchantId/analytics', authenticateToken, async (req: Request, res: Response) => {
  try {
    const merchantId = parseInt(req.params.merchantId);
    
    // Ensure the request is coming from the merchant or an admin
    const isRequestingOwnData = (req as any).user?.merchantId === merchantId;
    const isAdminUser = (req as any).user?.role === 'admin';
    
    if (!isRequestingOwnData && !isAdminUser) {
      return res.status(403).json({ 
        success: false, 
        message: "You are not authorized to access this merchant's data" 
      });
    }
    
    const analytics = await merchantAnalyticsService.getContractSummary(merchantId);
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    logger.error({
      message: 'Error fetching merchant analytics',
      error,
      metadata: { merchantId: req.params.merchantId }
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve merchant analytics'
    });
  }
});

// Route to get merchant contracts
router.get('/merchant/:merchantId/contracts', authenticateToken, async (req: Request, res: Response) => {
  try {
    const merchantId = parseInt(req.params.merchantId);
    
    // Ensure the request is coming from the merchant or an admin
    const isRequestingOwnData = (req as any).user?.merchantId === merchantId;
    const isAdminUser = (req as any).user?.role === 'admin';
    
    if (!isRequestingOwnData && !isAdminUser) {
      return res.status(403).json({ 
        success: false, 
        message: "You are not authorized to access this merchant's data" 
      });
    }
    
    const contracts = await storage.getContractsByMerchantId(merchantId);
    
    res.json({
      success: true,
      data: contracts
    });
  } catch (error) {
    logger.error({
      message: 'Error fetching merchant contracts',
      error,
      metadata: { merchantId: req.params.merchantId }
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve merchant contracts'
    });
  }
});

export { merchantAnalyticsService };
export default router;
