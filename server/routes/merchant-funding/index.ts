import { Router, Request, Response } from "express";
import { authenticateToken, isMerchant } from "../../middleware/auth";
import fundingRouter from "./funding";
import { logger } from "../../services/logger";

const router = Router();

// Create a separate debug endpoint that doesn't require auth
router.get("/funding/debug/status", (req: Request, res: Response) => {
  // Log the debug request
  logger.info({
    message: "Debug status endpoint accessed",
    category: "api",
    source: "internal",
    metadata: {
      endpoint: "/api/merchant-funding/funding/debug/status",
      headers: req.headers,
      timestamp: new Date().toISOString()
    }
  });
  
  // Return a simple success response with timestamp
  return res.status(200).json({
    success: true, 
    message: "Merchant funding API is accessible",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Debug endpoint to return sample funding data without requiring auth
router.get("/funding/debug/data", (req: Request, res: Response) => {
  // Log the debug request
  logger.info({
    message: "Debug funding data endpoint accessed",
    category: "api",
    source: "internal",
    metadata: {
      endpoint: "/api/merchant-funding/funding/debug/data",
      timestamp: new Date().toISOString()
    }
  });
  
  // Create sample funding data for testing
  const sampleTransfers = [
    {
      id: 1,
      transferId: "tr_sample_123456",
      accountId: "acc_sample_123",
      amount: 250000,
      status: "completed",
      type: "credit",
      networkType: "ach",
      failureReason: null,
      description: "March 2025 funding - Contract #ABC123",
      createdAt: "2025-03-15T09:30:00",
      merchantId: 1,
      contractId: 123
    },
    {
      id: 2,
      transferId: "tr_sample_789012",
      accountId: "acc_sample_123",
      amount: 150000,
      status: "pending",
      type: "credit",
      networkType: "ach",
      failureReason: null,
      description: "April 2025 advance payment",
      createdAt: "2025-03-25T14:15:00",
      merchantId: 1,
      contractId: 124
    },
    {
      id: 3,
      transferId: "tr_sample_345678",
      accountId: "acc_sample_123",
      amount: 5000,
      status: "failed",
      type: "credit",
      networkType: "ach",
      failureReason: "insufficient_funds",
      description: "Processing fee refund",
      createdAt: "2025-03-18T11:45:00",
      merchantId: 1,
      contractId: null
    },
    {
      id: 4,
      transferId: "tr_sample_905431",
      accountId: "acc_sample_123",
      amount: 180000,
      status: "completed",
      type: "credit",
      networkType: "ach",
      failureReason: null,
      description: "February 2025 funding - Contract #DEF456",
      createdAt: "2025-02-20T10:15:00",
      merchantId: 1,
      contractId: 125
    },
    {
      id: 5,
      transferId: "tr_sample_287634",
      accountId: "acc_sample_123",
      amount: 2500,
      status: "cancelled",
      type: "debit",
      networkType: "ach",
      failureReason: null,
      description: "Service fee - cancelled",
      createdAt: "2025-03-20T16:45:00",
      merchantId: 1,
      contractId: null
    },
    {
      id: 6,
      transferId: "tr_sample_716249",
      accountId: "acc_sample_123",
      amount: 300000,
      status: "completed",
      type: "credit",
      networkType: "ach",
      failureReason: null,
      description: "January 2025 funding - Contract #GHI789",
      createdAt: "2025-01-10T08:30:00",
      merchantId: 1,
      contractId: 126
    }
  ];
  
  return res.status(200).json({ 
    success: true,
    transfers: sampleTransfers 
  });
});

// Apply authentication to all other merchant funding routes
router.use(authenticateToken);

// Apply merchant role check to all authenticated routes
router.use(isMerchant);

// Mount the funding routes for merchant API
router.use("/funding", fundingRouter);

export default router;