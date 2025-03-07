import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { logger } from "../services/logger";
import { diditService } from "../services/didit";
import { preFiService } from "../services/prefi";
import { underwritingService } from "../services/underwriting";

// Define enums for logs
export enum LogCategory {
  System = "system",
  User = "user",
  API = "api",
  Payment = "payment",
  Security = "security",
  Contract = "contract"
}

export enum LogSource {
  Internal = "internal",
  Twilio = "twilio",
  Didit = "didit",
  Plaid = "plaid",
  ThanksRoger = "thanksroger",
  PreFi = "prefi"
}

export const kycRouter = Router();

// DiDit KYC Webhook endpoint - for receiving status updates from DiDit
kycRouter.post("/webhook", async (req: Request, res: Response) => {
  try {
    // Extract webhook signature from headers for verification
    const signature = req.headers["x-didit-signature"] as string || 
                      req.headers["x-signature"] as string;
    const timestamp = req.headers["x-timestamp"] as string;

    // Log the receipt of webhook
    logger.info({
      message: `Received DiDit webhook event`,
      category: LogCategory.API,
      source: LogSource.Didit,
      metadata: {
        eventType: req.body.event_type || req.body.status,
        sessionId: req.body.session_id,
        headers: req.headers,
      },
    });

    // Verify the webhook signature if we have the secret
    let isVerified = false;
    if (signature) {
      try {
        // Store the raw body for signature verification
        const rawBody = JSON.stringify(req.body);
        isVerified = diditService.verifyWebhookSignature(rawBody, signature);
      } catch (error) {
        logger.error({
          message: `Failed to verify DiDit webhook signature: ${error instanceof Error ? error.message : String(error)}`,
          category: LogCategory.Security,
          source: LogSource.Didit,
          metadata: {
            error: error instanceof Error ? error.stack : null,
          },
        });
      }
    }

    // Extract key information from the webhook
    const { event_type, session_id, status, decision, vendor_data } = req.body;

    // Parse vendor_data to extract contractId
    let contractId = null;
    try {
      if (vendor_data) {
        const parsedData = JSON.parse(vendor_data);
        contractId = parsedData.contractId;
      }
    } catch (error) {
      logger.warn({
        message: `Failed to parse vendor_data in DiDit webhook: ${error instanceof Error ? error.message : String(error)}`,
        category: LogCategory.API,
        source: LogSource.Didit,
        metadata: { vendor_data },
      });
    }

    logger.info({
      message: `Processing DiDit webhook for contract ${contractId}, session ${session_id}`,
      category: LogCategory.API,
      source: LogSource.Didit,
      metadata: {
        contractId,
        sessionId: session_id,
        status: status || event_type,
        isVerified,
      },
    });

    if (!contractId) {
      logger.warn({
        message: "Missing contractId in DiDit webhook vendor_data",
        category: LogCategory.API,
        source: LogSource.Didit,
        metadata: { vendor_data },
      });
      return res.status(200).json({
        status: "success",
        message: "Webhook received but no contractId found",
      });
    }

    // Handle verification.completed event
    if (
      event_type === "verification.completed" ||
      status === "Approved" ||
      status === "Declined"
    ) {
      logger.info({
        message: `DiDit verification completed for session ${session_id}, contract ${contractId}`,
        category: LogCategory.API,
        source: LogSource.Didit,
        metadata: {
          sessionId: session_id,
          contractId,
          status,
          decisionStatus: decision?.status,
        },
      });

      // Check if verification was approved
      const isApproved =
        decision?.status === "approved" ||
        status === "Approved" ||
        status === "approved" ||
        status === "completed";

      try {
        // Get the contract details
        const contract = await storage.getContract(parseInt(contractId));
        if (!contract) {
          throw new Error(`Contract ${contractId} not found`);
        }

        // Get the credit profile for this contract
        const creditProfile = await storage.getCreditProfileByContractId(parseInt(contractId));
        if (!creditProfile) {
          throw new Error(`Credit profile for contract ${contractId} not found`);
        }

        if (isApproved) {
          // Submit to Pre-Fi for pre-qualification
          const preFiData = await preFiService.preQualify({
            FirstName: creditProfile.firstName,
            LastName: creditProfile.lastName,
            Email: creditProfile.email,
            Phone: creditProfile.phone || "",
            ConsentDate: creditProfile.consentDate.toISOString(),
            ConsentIP: creditProfile.consentIp,
          });

          // Update credit profile with Pre-Fi data
          await storage.updateCreditProfile(creditProfile.id, {
            preFiData: JSON.stringify(preFiData),
            creditScore: preFiService.parseCreditScore(preFiData),
          });

          // Extract underwriting data from Pre-Fi response
          const underwritingData = underwritingService.extractUnderwritingData(creditProfile);

          // Calculate underwriting result
          const underwritingResult = underwritingService.calculateUnderwriting(underwritingData);

          // Store underwriting result - adjust creditTier casing to match schema
          await storage.createUnderwriting({
            creditProfileId: creditProfile.id,
            contractId: parseInt(contractId),
            totalScore: underwritingResult.totalPoints,
            annualIncomePoints: underwritingResult.annualIncomePoints,
            employmentHistoryPoints: underwritingResult.employmentHistoryPoints,
            creditScorePoints: underwritingResult.creditScorePoints,
            dtiRatioPoints: underwritingResult.dtiRatioPoints,
            housingStatusPoints: underwritingResult.housingStatusPoints,
            delinquencyHistoryPoints: underwritingResult.delinquencyHistoryPoints,
            annualIncome: underwritingData.annualIncome,
            dtiRatio: underwritingData.dtiRatio,
            status: underwritingResult.status.toLowerCase() as any,
            creditTier: underwritingResult.creditTier.toLowerCase() as any,
          });

          // Update application progress
          const applicationProgress = await storage.getApplicationProgressByContractId(parseInt(contractId));
          const kycStep = applicationProgress.find((step) => step.step === "kyc");

          if (kycStep) {
            await storage.updateApplicationProgressCompletion(kycStep.id, true, JSON.stringify({
              completed: true,
              verificationId: session_id,
              kycApproved: true,
              completedAt: new Date().toISOString(),
            }));
          }

          // Update contract status based on underwriting result
          await storage.updateContractStatus(parseInt(contractId), underwritingResult.status);

          logger.info({
            message: `Completed underwriting for contract ${contractId}`,
            category: LogCategory.Contract,
            source: LogSource.Internal,
            metadata: {
              contractId,
              creditProfileId: creditProfile.id,
              creditTier: underwritingResult.creditTier,
              status: underwritingResult.status,
            },
          });
        } else {
          // Handle KYC failure
          logger.warn({
            message: `KYC verification failed for contract ${contractId}`,
            category: LogCategory.Contract,
            source: LogSource.Didit,
            metadata: {
              contractId,
              sessionId: session_id,
              status,
              decision,
            },
          });

          // Update application progress to mark KYC as failed
          const applicationProgress = await storage.getApplicationProgressByContractId(parseInt(contractId));
          const kycStep = applicationProgress.find((step) => step.step === "kyc");

          if (kycStep) {
            await storage.updateApplicationProgressCompletion(kycStep.id, false, JSON.stringify({
              completed: false,
              verificationId: session_id,
              kycApproved: false,
              failureReason: decision?.reason || "Verification declined",
              failedAt: new Date().toISOString(),
            }));
          }

          // Update contract status to declined
          await storage.updateContractStatus(parseInt(contractId), "declined");
        }
      } catch (error) {
        logger.error({
          message: `Error processing KYC completion: ${error instanceof Error ? error.message : String(error)}`,
          category: LogCategory.Contract,
          source: LogSource.Internal,
          metadata: {
            error: error instanceof Error ? error.stack : null,
            contractId,
            sessionId: session_id,
          },
        });
      }
    }

    // Always respond with 200 OK to acknowledge receipt of the webhook
    return res.status(200).json({ status: "success" });
  } catch (error) {
    logger.error({
      message: `Error processing DiDit webhook: ${error instanceof Error ? error.message : String(error)}`,
      category: LogCategory.API,
      source: LogSource.Didit,
      metadata: {
        error: error instanceof Error ? error.stack : null,
      },
    });

    // Always return 200 to prevent DiDit from retrying (prevents duplicate processing)
    return res.status(200).json({
      status: "error",
      error_message: "Error processing webhook, but acknowledged receipt",
    });
  }
});