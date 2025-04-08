import { Router, Request, Response } from "express";
import { db } from "../../db";
import { contracts } from "@shared/schema";
import { eq } from "drizzle-orm";
import { storage } from "../../storage";
import { logger } from "../../services/logger";
import { coveredCareService } from "../../services/coveredCare";
import { z } from "zod";

const router = Router();

/**
 * @route POST /api/admin/cancel-coveredcare-contract/:id
 * @desc Cancel a Covered Care funded contract via the Covered Care API
 * @access Private - Admin only
 */
router.post("/:id", async (req: Request, res: Response) => {
  try {
    // Ensure the user is an admin
    if (req.user?.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Forbidden - Admin permission required"
      });
    }

    const contractId = parseInt(req.params.id);
    if (isNaN(contractId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid contract ID"
      });
    }

    // Get the contract
    const contract = await storage.getContract(contractId);
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Contract not found"
      });
    }

    // Verify this is a Covered Care contract
    if (contract.fundingSource !== "CoveredCare") {
      return res.status(400).json({
        success: false,
        message: "This contract is not funded by Covered Care"
      });
    }

    // Get funding source data
    const fundingSourceData = contract.fundingSourceData || {};
    
    if (!fundingSourceData.loanNumber || !fundingSourceData.providerGuid || !fundingSourceData.branchLocationGuid) {
      return res.status(400).json({
        success: false,
        message: "Missing required Covered Care loan details"
      });
    }

    // Validate request body (optional notes)
    const cancelSchema = z.object({
      notes: z.string().optional(),
      reason: z.string().optional()
    });

    const validationResult = cancelSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid request body",
        errors: validationResult.error.format()
      });
    }

    const { notes, reason } = validationResult.data;

    // Call Covered Care API to cancel the loan
    await coveredCareService.cancelLoan(
      fundingSourceData.providerGuid,
      fundingSourceData.branchLocationGuid,
      fundingSourceData.loanNumber
    );

    // Update contract status to cancelled
    await db.update(contracts)
      .set({
        status: "cancelled",
        cancellationReason: reason || "Admin cancelled via Covered Care API",
        cancellationNotes: notes || null,
        cancellationApprovedAt: new Date(),
        cancellationApprovedBy: req.user.id
      })
      .where(eq(contracts.id, contractId));

    // Log the cancellation
    logger.info({
      message: "Contract cancelled via Covered Care API",
      category: "contract",
      source: "internal",
      userId: req.user.id,
      metadata: {
        contractId,
        loanNumber: fundingSourceData.loanNumber,
        reason
      }
    });

    return res.status(200).json({
      success: true,
      message: "Contract successfully cancelled in Covered Care"
    });
  } catch (error) {
    logger.error({
      message: `Error cancelling Covered Care loan: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "internal",
      metadata: {
        error: error instanceof Error ? error.stack : null,
      }
    });

    return res.status(500).json({
      success: false,
      message: "Failed to cancel Covered Care loan",
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;