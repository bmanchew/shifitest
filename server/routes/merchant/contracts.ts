import { Router, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../../storage";
import { logger } from "../../services/logger";
import { authenticateToken, isMerchant } from "../../middleware/auth";

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);
router.use(isMerchant);

// Get all contracts for the authenticated merchant
router.get("/", async (req: Request, res: Response) => {
  try {
    // Get the merchant ID for the authenticated user
    const merchantId = req.user!.merchantId;
    
    // Get contracts for this merchant
    const contracts = await storage.getContractsByMerchantId(merchantId);
    
    // Return the contracts
    return res.status(200).json({
      success: true,
      contracts
    });
  } catch (error) {
    logger.error({
      message: `Error fetching merchant contracts: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        error: error instanceof Error ? error.stack : String(error),
        userId: req.user?.id
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to fetch contracts",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Request cancellation for a contract
router.post("/:contractId/request-cancellation", async (req: Request, res: Response) => {
  try {
    const contractId = parseInt(req.params.contractId);
    const userId = req.user!.id;
    const merchantId = req.user!.merchantId;
    
    // Validate request body
    const bodySchema = z.object({
      reason: z.string().min(5, "Reason must be at least 5 characters long"),
      notes: z.string().optional()
    });
    
    const validationResult = bodySchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
        errors: validationResult.error.errors
      });
    }
    
    const { reason, notes } = validationResult.data;
    
    // Get the contract to verify ownership
    const contract = await storage.getContract(contractId);
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Contract not found"
      });
    }
    
    // Verify the contract belongs to the merchant
    if (contract.merchantId !== merchantId) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to request cancellation for this contract"
      });
    }
    
    // Check if the contract status allows for cancellation
    if (contract.status !== "active" && contract.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: `Contract is in ${contract.status} status and cannot be cancelled`
      });
    }
    
    // Check if there's already a pending cancellation request
    const existingRequests = await storage.getContractCancellationRequestsByContractId(contractId);
    const pendingRequest = existingRequests.find(req => 
      ["pending", "under_review"].includes(req.status)
    );
    
    if (pendingRequest) {
      return res.status(409).json({
        success: false,
        message: "There is already a pending cancellation request for this contract",
        requestId: pendingRequest.id
      });
    }
    
    // Create the cancellation request
    const cancellationRequest = await storage.createContractCancellationRequest({
      contractId,
      merchantId,
      requestedBy: userId,
      requestReason: reason,
      requestNotes: notes || null,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Update contract status
    await storage.updateContractStatus(contractId, "cancellation_requested");
    
    // Notify admins
    const adminUsers = await storage.getAdminUsers();
    
    for (const admin of adminUsers) {
      // Create a notification
      const notification = await storage.createNotification({
        type: "contract_cancellation_request",
        title: "New Contract Cancellation Request",
        message: `Merchant ${contract.merchantId} has requested cancellation of contract #${contractId}`,
        recipientType: "admin",
        recipientId: admin.id,
        priority: "medium",
        status: "pending",
        metadata: JSON.stringify({
          contractId,
          merchantId,
          requestId: cancellationRequest.id,
          reason
        }),
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // Create in-app notification
      await storage.createInAppNotification({
        notificationId: notification,
        userId: admin.id,
        userType: "admin",
        type: "contract_cancellation_request",
        title: "New Contract Cancellation Request",
        message: `Merchant ${contract.merchantId} has requested cancellation of contract #${contractId}`,
        status: "unread",
        metadata: JSON.stringify({
          contractId,
          merchantId,
          requestId: cancellationRequest.id,
          reason
        }),
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    // Log the action
    logger.info({
      message: `Contract cancellation requested for contract ${contractId} by merchant ${merchantId}`,
      category: "contract",
      source: "internal",
      userId,
      metadata: {
        contractId,
        merchantId,
        requestId: cancellationRequest.id,
        reason
      }
    });
    
    return res.status(201).json({
      success: true,
      message: "Cancellation request submitted successfully",
      id: cancellationRequest.id
    });
  } catch (error) {
    logger.error({
      message: `Error requesting contract cancellation: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        error: error instanceof Error ? error.stack : String(error),
        userId: req.user?.id,
        contractId: req.params.contractId
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to submit cancellation request",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Get cancellation requests for a contract
router.get("/:contractId/cancellation-requests", async (req: Request, res: Response) => {
  try {
    const contractId = parseInt(req.params.contractId);
    const merchantId = req.user!.merchantId;
    
    // Get the contract to verify ownership
    const contract = await storage.getContract(contractId);
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Contract not found"
      });
    }
    
    // Verify the contract belongs to the merchant
    if (contract.merchantId !== merchantId) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to view cancellation requests for this contract"
      });
    }
    
    // Get cancellation requests for this contract
    const requests = await storage.getContractCancellationRequestsByContractId(contractId);
    
    // Return the requests
    return res.status(200).json({
      success: true,
      requests
    });
  } catch (error) {
    logger.error({
      message: `Error fetching cancellation requests: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        error: error instanceof Error ? error.stack : String(error),
        userId: req.user?.id,
        contractId: req.params.contractId
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to fetch cancellation requests",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router;