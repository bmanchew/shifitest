import { Router, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../../storage";
import { logger } from "../../services/logger";
import { authenticateToken, isAdmin } from "../../middleware/auth";

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);
router.use(isAdmin);

// Get all pending cancellation requests
router.get("/pending", async (req: Request, res: Response) => {
  try {
    const pendingRequests = await storage.getContractCancellationRequestsByStatus("pending");
    
    // Enhance the requests with contract and merchant info
    const enhancedRequests = await Promise.all(pendingRequests.map(async (request) => {
      const contract = await storage.getContract(request.contractId);
      const merchant = await storage.getMerchant(request.merchantId);
      
      return {
        ...request,
        contract: contract ? {
          contractNumber: contract.contractNumber,
          amount: contract.amount,
          status: contract.status,
          termMonths: contract.termMonths,
          startDate: contract.startDate,
          endDate: contract.endDate
        } : null,
        merchant: merchant ? {
          name: merchant.name,
          businessName: merchant.name, // This should be replaced with the actual business name field
          contactName: merchant.contactName,
          contactEmail: merchant.email,
          contactPhone: merchant.phone
        } : null
      };
    }));
    
    return res.status(200).json({
      success: true,
      requests: enhancedRequests
    });
  } catch (error) {
    logger.error({
      message: `Error fetching pending cancellation requests: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        error: error instanceof Error ? error.stack : String(error),
        userId: req.user?.id
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to fetch pending cancellation requests",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Get cancellation request by ID
router.get("/:requestId", async (req: Request, res: Response) => {
  try {
    const requestId = parseInt(req.params.requestId);
    
    const request = await storage.getContractCancellationRequest(requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Cancellation request not found"
      });
    }
    
    const contract = await storage.getContract(request.contractId);
    const merchant = await storage.getMerchant(request.merchantId);
    
    const enhancedRequest = {
      ...request,
      contract: contract ? {
        contractNumber: contract.contractNumber,
        amount: contract.amount,
        status: contract.status,
        termMonths: contract.termMonths,
        startDate: contract.startDate,
        endDate: contract.endDate
      } : null,
      merchant: merchant ? {
        name: merchant.name,
        businessName: merchant.name, // This should be replaced with the actual business name field
        contactName: merchant.contactName,
        contactEmail: merchant.email,
        contactPhone: merchant.phone
      } : null
    };
    
    return res.status(200).json({
      success: true,
      request: enhancedRequest
    });
  } catch (error) {
    logger.error({
      message: `Error fetching cancellation request: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        error: error instanceof Error ? error.stack : String(error),
        userId: req.user?.id,
        requestId: req.params.requestId
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to fetch cancellation request",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Set a cancellation request under review
router.post("/:requestId/review", async (req: Request, res: Response) => {
  try {
    const requestId = parseInt(req.params.requestId);
    const adminId = req.user!.id;
    
    // Get the request to ensure it exists
    const request = await storage.getContractCancellationRequest(requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Cancellation request not found"
      });
    }
    
    // Ensure the request is in a state that can be reviewed
    if (request.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: `Cancellation request is in ${request.status} status and cannot be reviewed`
      });
    }
    
    // Update the request status
    const updatedRequest = await storage.updateContractCancellationRequest(requestId, {
      status: "under_review",
      reviewedBy: adminId,
      reviewStartedAt: new Date(),
      updatedAt: new Date()
    });
    
    // Create notification for merchant
    const merchant = await storage.getMerchant(request.merchantId);
    const merchantUser = await storage.getUserByMerchantId(request.merchantId);
    
    if (merchantUser) {
      const notification = await storage.createNotification({
        type: "contract_cancellation_under_review",
        message: `Your cancellation request for contract #${request.contractId} is now under review`,
        title: "Cancellation Request Under Review",
        recipientType: "merchant",
        recipientId: merchantUser.id,
        priority: "medium",
        status: "pending",
        metadata: JSON.stringify({
          requestId,
          contractId: request.contractId
        }),
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // Create in-app notification
      await storage.createInAppNotification({
        notificationId: notification,
        userId: merchantUser.id,
        userType: "merchant",
        type: "contract_cancellation_under_review",
        title: "Cancellation Request Under Review",
        message: `Your cancellation request for contract #${request.contractId} is now under review`,
        status: "unread",
        metadata: JSON.stringify({
          requestId,
          contractId: request.contractId
        }),
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    // Log the action
    logger.info({
      message: `Cancellation request ${requestId} set to under review by admin ${adminId}`,
      category: "contract",
      source: "internal",
      userId: adminId,
      metadata: {
        requestId,
        contractId: request.contractId,
        merchantId: request.merchantId
      }
    });
    
    return res.status(200).json({
      success: true,
      message: "Cancellation request is now under review",
      request: updatedRequest
    });
  } catch (error) {
    logger.error({
      message: `Error setting cancellation request under review: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        error: error instanceof Error ? error.stack : String(error),
        userId: req.user?.id,
        requestId: req.params.requestId
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to set cancellation request under review",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Approve a cancellation request
router.post("/:requestId/approve", async (req: Request, res: Response) => {
  try {
    const requestId = parseInt(req.params.requestId);
    const adminId = req.user!.id;
    
    // Validate request body
    const bodySchema = z.object({
      adminNotes: z.string().optional(),
      refundAmount: z.number().min(0).optional()
    });
    
    const validationResult = bodySchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
        errors: validationResult.error.errors
      });
    }
    
    const { adminNotes, refundAmount } = validationResult.data;
    
    // Get the request to ensure it exists
    const request = await storage.getContractCancellationRequest(requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Cancellation request not found"
      });
    }
    
    // Ensure the request is in a state that can be approved
    if (request.status !== "under_review") {
      return res.status(409).json({
        success: false,
        message: `Cancellation request is in ${request.status} status and cannot be approved`
      });
    }
    
    // Update the request status
    const updatedRequest = await storage.updateContractCancellationRequest(requestId, {
      status: "approved",
      approvedBy: adminId,
      approvedAt: new Date(),
      adminNotes: adminNotes || null,
      refundAmount: refundAmount || 0,
      updatedAt: new Date()
    });
    
    // Update contract status
    await storage.updateContractStatus(request.contractId, "cancelled");
    
    // Create notification for merchant
    const merchant = await storage.getMerchant(request.merchantId);
    const merchantUser = await storage.getUserByMerchantId(request.merchantId);
    
    if (merchantUser) {
      const notification = await storage.createNotification({
        type: "contract_cancellation_approved",
        message: `Your cancellation request for contract #${request.contractId} has been approved`,
        title: "Cancellation Request Approved",
        recipientType: "merchant",
        recipientId: merchantUser.id,
        priority: "high",
        status: "pending",
        metadata: JSON.stringify({
          requestId,
          contractId: request.contractId,
          refundAmount: refundAmount || 0
        }),
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // Create in-app notification
      await storage.createInAppNotification({
        notificationId: notification,
        userId: merchantUser.id,
        userType: "merchant",
        type: "contract_cancellation_approved",
        title: "Cancellation Request Approved",
        message: `Your cancellation request for contract #${request.contractId} has been approved`,
        status: "unread",
        metadata: JSON.stringify({
          requestId,
          contractId: request.contractId,
          refundAmount: refundAmount || 0
        }),
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    // Log the action
    logger.info({
      message: `Cancellation request ${requestId} approved by admin ${adminId}`,
      category: "contract",
      source: "internal",
      userId: adminId,
      metadata: {
        requestId,
        contractId: request.contractId,
        merchantId: request.merchantId,
        refundAmount: refundAmount || 0
      }
    });
    
    return res.status(200).json({
      success: true,
      message: "Cancellation request approved",
      request: updatedRequest
    });
  } catch (error) {
    logger.error({
      message: `Error approving cancellation request: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        error: error instanceof Error ? error.stack : String(error),
        userId: req.user?.id,
        requestId: req.params.requestId
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to approve cancellation request",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Reject a cancellation request
router.post("/:requestId/reject", async (req: Request, res: Response) => {
  try {
    const requestId = parseInt(req.params.requestId);
    const adminId = req.user!.id;
    
    // Validate request body
    const bodySchema = z.object({
      denialReason: z.string().min(5, "Denial reason must be at least 5 characters long"),
      adminNotes: z.string().optional()
    });
    
    const validationResult = bodySchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
        errors: validationResult.error.errors
      });
    }
    
    const { denialReason, adminNotes } = validationResult.data;
    
    // Get the request to ensure it exists
    const request = await storage.getContractCancellationRequest(requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Cancellation request not found"
      });
    }
    
    // Ensure the request is in a state that can be rejected
    if (request.status !== "under_review") {
      return res.status(409).json({
        success: false,
        message: `Cancellation request is in ${request.status} status and cannot be rejected`
      });
    }
    
    // Update the request status
    const updatedRequest = await storage.updateContractCancellationRequest(requestId, {
      status: "denied",
      deniedBy: adminId,
      deniedAt: new Date(),
      denialReason: denialReason,
      adminNotes: adminNotes || null,
      updatedAt: new Date()
    });
    
    // Revert contract status if needed
    await storage.updateContractStatus(request.contractId, "active");
    
    // Create notification for merchant
    const merchant = await storage.getMerchant(request.merchantId);
    const merchantUser = await storage.getUserByMerchantId(request.merchantId);
    
    if (merchantUser) {
      const notification = await storage.createNotification({
        type: "contract_cancellation_denied",
        message: `Your cancellation request for contract #${request.contractId} has been denied: ${denialReason}`,
        title: "Cancellation Request Denied",
        recipientType: "merchant",
        recipientId: merchantUser.id,
        priority: "high",
        status: "pending",
        metadata: JSON.stringify({
          requestId,
          contractId: request.contractId,
          denialReason
        }),
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // Create in-app notification
      await storage.createInAppNotification({
        notificationId: notification,
        userId: merchantUser.id,
        userType: "merchant",
        type: "contract_cancellation_denied",
        title: "Cancellation Request Denied",
        message: `Your cancellation request for contract #${request.contractId} has been denied: ${denialReason}`,
        status: "unread",
        metadata: JSON.stringify({
          requestId,
          contractId: request.contractId,
          denialReason
        }),
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    // Log the action
    logger.info({
      message: `Cancellation request ${requestId} rejected by admin ${adminId}`,
      category: "contract",
      source: "internal",
      userId: adminId,
      metadata: {
        requestId,
        contractId: request.contractId,
        merchantId: request.merchantId,
        denialReason
      }
    });
    
    return res.status(200).json({
      success: true,
      message: "Cancellation request rejected",
      request: updatedRequest
    });
  } catch (error) {
    logger.error({
      message: `Error rejecting cancellation request: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        error: error instanceof Error ? error.stack : String(error),
        userId: req.user?.id,
        requestId: req.params.requestId
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to reject cancellation request",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router;