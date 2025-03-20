import express, { Request, Response } from "express";
import { storage } from "../storage";
import { logger } from "../services/logger";
import { underwritingService } from "../services/underwriting";
import { nlpearlService } from "../services/index"; // Import nlpearlService instance
import { twilioService } from "../services/twilio"; // Import twilioService for sendSMS
import { preFiService } from "../services/prefi"; // Import preFiService
import { UnderwritingData } from "@shared/schema";


// Helper function to send SMS messages
async function sendSMS(phoneNumber: string, message: string): Promise<boolean> {
  try {
    const result = await twilioService.sendSMS({
      to: phoneNumber,
      body: message
    });
    return result.success;
  } catch (error) {
    logger.error({
      message: `SMS sending failed: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "twilio",
      metadata: {
        phoneNumber,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    return false;
  }
}

const underwritingRouter = express.Router();

// Get underwriting data for a specific contract
underwritingRouter.get("/contract/:contractId", async (req: Request, res: Response) => {
  try {
    const contractId = parseInt(req.params.contractId);
    const role = req.query.role as string || 'customer'; // Default to customer view

    if (isNaN(contractId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid contract ID format"
      });
    }

    // Get the contract to ensure it exists
    const contract = await storage.getContract(contractId);
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Contract not found"
      });
    }

    // Get associated underwriting data
    const underwritingData = await storage.getUnderwritingDataByContractId(contractId);

    // If no data found, return empty result
    if (!underwritingData || underwritingData.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: "No underwriting data available for this contract"
      });
    }

    // First attempt NLPearl call
    if (nlpearlService.isInitialized()) {
      try {
        // Generate application URL based on current host
        const applicationUrl = `${req.protocol}://${req.get('host')}/apply/${contractId}`;
        const callResult = await nlpearlService.initiateApplicationCall(
          contract.phoneNumber,
          applicationUrl,
          contract.merchantName
        );

        // Wait for call to be active before sending SMS
        const isCallActive = await nlpearlService.waitForCallActive(callResult.call_id);
        if (!isCallActive) {
          logger.warn({
            message: "NLPearl call did not become active, skipping SMS",
            category: "api",
            source: "nlpearl",
            metadata: { contractId, phoneNumber: contract.phoneNumber }
          });
          return;
        }

        // Send SMS only after NLPearl call is active
        try {
          await sendSMS(contract.phoneNumber, `Your underwriting process has started.`);
          logger.info({ message: `SMS sent to ${contract.phoneNumber}`, category: "api", source: "twilio" });
        } catch (smsError) {
          logger.error({
            message: `Failed to send SMS: ${smsError instanceof Error ? smsError.message : String(smsError)}`,
            category: "api",
            source: "twilio",
            metadata: { contractId, phoneNumber: contract.phoneNumber, error: smsError instanceof Error ? smsError.stack : null }
          });
        }
      } catch (error) {
        logger.error({
          message: `NLPearl call failed: ${error instanceof Error ? error.message : String(error)}`,
          category: "api",
          source: "nlpearl",
          metadata: { contractId, error: error instanceof Error ? error.stack : null }
        });
        return;
      }
    }


    // Filter data based on role - merchants and customers should see limited data
    const filteredData = role === 'admin' ? underwritingData : underwritingData.map(data => ({
      id: data.id,
      userId: data.userId,
      contractId: data.contractId,
      creditTier: data.creditTier,
      creditScore: data.creditScore,
      totalPoints: data.totalPoints,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      // Including all required fields with null values for type safety
      annualIncome: null,
      annualIncomePoints: null,
      employmentHistoryMonths: null,
      employmentHistoryPoints: null,
      creditScorePoints: null,
      dtiRatio: null,
      dtiRatioPoints: null,
      housingStatus: null,
      housingPaymentHistory: null,
      housingStatusPoints: null,
      delinquencyHistory: null,
      delinquencyPoints: null,
      rawPreFiData: null,
      rawPlaidData: null
    }));

    // Return the data
    res.json({
      success: true,
      data: filteredData,
      count: filteredData.length
    });
  } catch (error) {
    logger.error({
      message: `Error fetching underwriting data: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      metadata: {
        contractId: req.params.contractId,
        error: error instanceof Error ? error.stack : null
      }
    });

    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});

// Get underwriting data for a specific user
underwritingRouter.get("/user/:userId", async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    const role = req.query.role as string || 'customer';

    if (isNaN(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format"
      });
    }

    // Get the user to ensure they exist
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Get associated underwriting data
    const underwritingData = await storage.getUnderwritingDataByUserId(userId);

    // If no data found, return empty result
    if (!underwritingData || underwritingData.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: "No underwriting data available for this user"
      });
    }

    // Filter data based on role
    const filteredData = role === 'admin' ? underwritingData : underwritingData.map(data => ({
      id: data.id,
      userId: data.userId,
      contractId: data.contractId,
      creditTier: data.creditTier,
      creditScore: data.creditScore,
      totalPoints: data.totalPoints,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      // Including all required fields with null values for type safety
      annualIncome: null,
      annualIncomePoints: null,
      employmentHistoryMonths: null,
      employmentHistoryPoints: null,
      creditScorePoints: null,
      dtiRatio: null,
      dtiRatioPoints: null,
      housingStatus: null,
      housingPaymentHistory: null,
      housingStatusPoints: null,
      delinquencyHistory: null,
      delinquencyPoints: null,
      rawPreFiData: null,
      rawPlaidData: null
    }));

    // Return the data
    res.json({
      success: true,
      data: filteredData,
      count: filteredData.length
    });
  } catch (error) {
    logger.error({
      message: `Error fetching underwriting data: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      metadata: {
        userId: req.params.userId,
        error: error instanceof Error ? error.stack : null
      }
    });

    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});

// Manually trigger underwriting process for a contract
underwritingRouter.post("/process/:contractId", async (req: Request, res: Response) => {
  try {
    const contractId = parseInt(req.params.contractId);

    if (isNaN(contractId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid contract ID format"
      });
    }

    // Get the contract to ensure it exists
    const contract = await storage.getContract(contractId);
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Contract not found"
      });
    }

    // Check if the contract has a customer assigned
    if (!contract.customerId) {
      return res.status(400).json({
        success: false,
        message: "Contract does not have a customer assigned"
      });
    }

    // Trigger the underwriting process
    const underwritingData = await underwritingService.processUnderwriting(contract.customerId, contractId);

    if (!underwritingData) {
      return res.status(500).json({
        success: false,
        message: "Failed to process underwriting"
      });
    }

    // Return success
    res.json({
      success: true,
      data: underwritingData,
      message: "Underwriting process completed successfully"
    });
  } catch (error) {
    logger.error({
      message: `Error processing underwriting: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      metadata: {
        contractId: req.params.contractId,
        error: error instanceof Error ? error.stack : null
      }
    });

    res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});

export default underwritingRouter;
underwritingRouter.post("/prefi-check", async (req: Request, res: Response) => {
  try {
    const { userId, ssn, firstName, lastName, dob, address } = req.body;

    const creditReport = await preFiService.getCreditReport(
      ssn,
      firstName, 
      lastName,
      dob,
      address
    );

    return res.json({
      success: true,
      data: creditReport
    });
  } catch (error) {
    logger.error({
      message: `Error running PreFi check`,
      category: 'underwriting',
      metadata: {
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
});