import { Request, Response } from "express";
import { z } from "zod";
import { storage } from "../../storage";
import { logger } from "../../services/logger";

// Get all pending cancellation requests
export async function getPendingCancellationRequests(req: Request, res: Response) {
  try {
    const requests = await storage.getPendingContractCancellationRequests();
    
    // Enhance the response with contract and merchant details
    const enhancedRequests = await Promise.all(
      requests.map(async (request) => {
        const contract = await storage.getContract(request.contractId);
        const merchant = contract ? await storage.getMerchant(contract.merchantId) : null;
        
        return {
          ...request,
          contract: contract || null,
          merchant: merchant ? {
            id: merchant.id,
            businessName: merchant.businessName,
            contactEmail: merchant.contactEmail,
            contactPhone: merchant.contactPhone
          } : null
        };
      })
    );
    
    return res.status(200).json({
      success: true,
      requests: enhancedRequests
    });
  } catch (error) {
    logger.error({
      message: `Error getting pending cancellation requests: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve pending cancellation requests",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

// Approve a cancellation request
export async function approveCancellationRequest(req: Request, res: Response) {
  try {
    const requestId = parseInt(req.params.requestId);
    const adminId = req.user!.id;
    
    // Validate request body
    const bodySchema = z.object({
      notes: z.string().optional(),
      refundAmount: z.number().optional(),
      fundingCycleAdjustment: z.number().optional()
    });
    
    const validationResult = bodySchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid request data",
        errors: validationResult.error.errors
      });
    }
    
    const { notes, refundAmount, fundingCycleAdjustment } = validationResult.data;
    
    // Get the cancellation request to ensure it exists
    const request = await storage.getContractCancellationRequest(requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Cancellation request not found"
      });
    }
    
    // Ensure the request is in a state that can be approved
    if (request.status !== "pending" && request.status !== "under_review") {
      return res.status(409).json({
        success: false,
        message: `Cannot approve request with status: ${request.status}`
      });
    }
    
    // Update the cancellation request status
    const updatedRequest = await storage.updateContractCancellationRequestStatus(
      requestId,
      "approved",
      adminId
    );
    
    if (!updatedRequest) {
      return res.status(500).json({
        success: false,
        message: "Failed to update cancellation request status"
      });
    }
    
    // Add additional data to the request if provided
    if (notes || refundAmount !== undefined || fundingCycleAdjustment !== undefined) {
      const updateData: Record<string, any> = {};
      
      if (notes) {
        updateData.reviewNotes = notes;
      }
      
      if (refundAmount !== undefined) {
        updateData.refundAmount = refundAmount;
      }
      
      if (fundingCycleAdjustment !== undefined) {
        updateData.fundingCycleAdjustment = fundingCycleAdjustment;
      }
      
      await storage.updateContractCancellationRequest(requestId, updateData);
    }
    
    // Update the contract status to cancelled
    await storage.updateContractStatus(request.contractId, "cancelled");
    
    // Create notification for the merchant
    const contract = await storage.getContract(request.contractId);
    const merchant = contract ? await storage.getMerchant(contract.merchantId) : null;
    
    if (merchant) {
      // Get the merchant user to send notification
      const merchantUser = await storage.getUserByMerchantId(merchant.id);
      
      if (merchantUser) {
        const notification = await storage.createNotification({
          type: "contract_cancellation_approved",
          title: `Contract cancellation approved (#${contract?.contractNumber})`,
          message: `Your cancellation request for contract #${contract?.contractNumber} has been approved.`,
          recipientType: "merchant",
          recipientId: merchantUser.id,
          priority: "high",
          status: "unread",
          metadata: JSON.stringify({
            contractId: request.contractId,
            requestId: request.id
          }),
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        // Create in-app notification
        await storage.createInAppNotification({
          notificationId: notification,
          userId: merchantUser.id,
          userType: "merchant",
          read: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: JSON.stringify({
            contractId: request.contractId,
            requestId: request.id,
            action: "view_cancelled_contract"
          })
        });
      }
    }
    
    // Log the approval
    logger.info({
      message: `Contract cancellation request ${requestId} approved by admin ${adminId}`,
      category: "contract",
      source: "internal",
      userId: adminId,
      metadata: {
        requestId,
        contractId: request.contractId,
        merchantId: request.merchantId,
        refundAmount,
        fundingCycleAdjustment
      }
    });
    
    return res.status(200).json({
      success: true,
      message: "Cancellation request approved successfully",
      request: updatedRequest
    });
  } catch (error) {
    logger.error({
      message: `Error approving cancellation request: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      userId: req.user?.id,
      metadata: {
        requestId: req.params.requestId,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to approve cancellation request",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

// Reject a cancellation request
export async function rejectCancellationRequest(req: Request, res: Response) {
  try {
    const requestId = parseInt(req.params.requestId);
    const adminId = req.user!.id;
    
    // Validate request body
    const bodySchema = z.object({
      denialReason: z.string().min(1, "Reason for rejection is required"),
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
    
    const { denialReason, notes } = validationResult.data;
    
    // Get the cancellation request to ensure it exists
    const request = await storage.getContractCancellationRequest(requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Cancellation request not found"
      });
    }
    
    // Ensure the request is in a state that can be rejected
    if (request.status !== "pending" && request.status !== "under_review") {
      return res.status(409).json({
        success: false,
        message: `Cannot reject request with status: ${request.status}`
      });
    }
    
    // Update the cancellation request status
    const updatedRequest = await storage.updateContractCancellationRequestStatus(
      requestId,
      "denied",
      adminId
    );
    
    if (!updatedRequest) {
      return res.status(500).json({
        success: false,
        message: "Failed to update cancellation request status"
      });
    }
    
    // Add denial reason and notes
    await storage.updateContractCancellationRequest(requestId, {
      denialReason,
      reviewNotes: notes
    });
    
    // Update the contract status back to active
    await storage.updateContractStatus(request.contractId, "active");
    
    // Create notification for the merchant
    const contract = await storage.getContract(request.contractId);
    const merchant = contract ? await storage.getMerchant(contract.merchantId) : null;
    
    if (merchant) {
      // Get the merchant user to send notification
      const merchantUser = await storage.getUserByMerchantId(merchant.id);
      
      if (merchantUser) {
        const notification = await storage.createNotification({
          type: "contract_cancellation_denied",
          title: `Contract cancellation denied (#${contract?.contractNumber})`,
          message: `Your cancellation request for contract #${contract?.contractNumber} has been denied: ${denialReason}`,
          recipientType: "merchant",
          recipientId: merchantUser.id,
          priority: "high",
          status: "unread",
          metadata: JSON.stringify({
            contractId: request.contractId,
            requestId: request.id,
            reason: denialReason
          }),
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        // Create in-app notification
        await storage.createInAppNotification({
          notificationId: notification,
          userId: merchantUser.id,
          userType: "merchant",
          read: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: JSON.stringify({
            contractId: request.contractId,
            requestId: request.id,
            action: "view_contract_details"
          })
        });
      }
    }
    
    // Log the rejection
    logger.info({
      message: `Contract cancellation request ${requestId} rejected by admin ${adminId}`,
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
      message: "Cancellation request rejected successfully",
      request: {
        ...updatedRequest,
        denialReason
      }
    });
  } catch (error) {
    logger.error({
      message: `Error rejecting cancellation request: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      userId: req.user?.id,
      metadata: {
        requestId: req.params.requestId,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to reject cancellation request",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

// Set a cancellation request to under review
export async function setRequestUnderReview(req: Request, res: Response) {
  try {
    const requestId = parseInt(req.params.requestId);
    const adminId = req.user!.id;
    
    // Get the cancellation request to ensure it exists
    const request = await storage.getContractCancellationRequest(requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Cancellation request not found"
      });
    }
    
    // Ensure the request is in pending state
    if (request.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: `Cannot set request with status ${request.status} to under review`
      });
    }
    
    // Update the cancellation request status
    const updatedRequest = await storage.updateContractCancellationRequestStatus(
      requestId,
      "under_review",
      adminId
    );
    
    if (!updatedRequest) {
      return res.status(500).json({
        success: false,
        message: "Failed to update cancellation request status"
      });
    }
    
    // Log the status update
    logger.info({
      message: `Contract cancellation request ${requestId} set to under review by admin ${adminId}`,
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
      message: "Cancellation request set to under review",
      request: updatedRequest
    });
  } catch (error) {
    logger.error({
      message: `Error setting cancellation request to under review: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      userId: req.user?.id,
      metadata: {
        requestId: req.params.requestId,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to update cancellation request status",
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
}