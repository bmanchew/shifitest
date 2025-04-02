import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { logger } from "../services/logger";
import jwt from "jsonwebtoken";
import express from 'express';
import { cfpbService } from '../services/cfpbService';
import { merchantAnalyticsService } from '../services/merchantAnalytics';
import { isMerchantUser } from '../routes'; // Fix isMerchantUser middleware reference


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

const router = express.Router();

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

    // Use the standard method to fetch contracts
    const contracts = await storage.getContractsByMerchantId(merchantId);

    // Return in the same format as other contract endpoints for consistency
    res.json({
      success: true,
      contracts: contracts // Return as "contracts" key to match other endpoints
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

// Get complaint trends data
router.get('/complaint-trends', async (req, res) => {
  try {
    logger.info({
      message: 'Fetching complaint trends data',
      category: 'api',
      source: 'admin',
    });

    // Try to get real data from the CFPB API
    try {
      // In a real app, we would aggregate data from multiple API calls
      // For demo purposes, we'll use the mock data
      const mockData = cfpbService.getMockComplaintTrends();

      logger.info({
        message: 'Successfully retrieved complaint trends',
        category: 'api',
        source: 'admin',
      });

      return res.json({ success: true, data: apiData });
    } catch (apiError) {
      logger.error({
        message: `Failed to retrieve data from CFPB API: ${apiError instanceof Error ? apiError.message : String(apiError)}`,
        category: 'api',
        source: 'admin',
        metadata: {
          error: apiError instanceof Error ? apiError.stack : null,
        }
      });

      // Return error response instead of mock data
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to retrieve data from CFPB API' 
      });
    }
  } catch (error) {
    logger.error({
      message: `Error retrieving complaint trends: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'admin',
      metadata: {
        error: error instanceof Error ? error.stack : null,
      },
    });

    res.status(500).json({
      success: false,
      message: 'Failed to retrieve complaint trends data'
    });
  }
});

// Additional merchant analytics endpoints can be added here

export default router;