import { Request, Response } from 'express';
import { openaiService } from '../services/openai';
import { plaidService } from '../services/plaid';
import { logger } from '../services/logger';
import { storage } from '../storage';

/**
 * Controller for AI-powered merchant verification
 */
export const merchantVerificationController = {
  /**
   * Verify merchant eligibility using AI analysis
   */
  async verifyMerchantEligibility(req: Request, res: Response) {
    try {
      const { merchantId, plaidData, businessInfo } = req.body;

      if (!merchantId) {
        return res.status(400).json({
          success: false,
          message: "Merchant ID is required"
        });
      }

      if (!plaidData || !businessInfo) {
        return res.status(400).json({
          success: false,
          message: "Plaid data and business information are required for verification"
        });
      }

      logger.info({
        message: "Starting AI-powered merchant verification",
        category: "api",
        source: "openai",
        metadata: { 
          merchantId,
          businessName: businessInfo.businessName || "Unknown" 
        }
      });

      // First check if OpenAI service is initialized
      if (!openaiService.isInitialized()) {
        logger.error({
          message: "OpenAI service not initialized for merchant verification",
          category: "api",
          source: "openai",
          metadata: { merchantId }
        });

        return res.status(503).json({
          success: false,
          message: "AI verification service is not available. Please try again later."
        });
      }

      // Get financial data from Plaid
      const financialData = {
        monthlyRevenue: plaidData.income?.monthlyIncome || 0,
        annualRevenue: plaidData.income?.yearlyIncome || 0,
        profitMargin: plaidData.profitMargin || 0,
        outstandingLoans: plaidData.loans?.totalOutstanding || 0,
        cashReserves: plaidData.accounts?.reduce((total: number, account: any) => 
          total + (account.balances?.available || account.balances?.current || 0), 0) || 0
      };

      // Prepare the merchant data for AI analysis
      const merchantData = {
        businessInfo,
        financialData,
        plaidData
      };

      // Perform AI-powered eligibility verification
      const verificationResult = await openaiService.verifyMerchantEligibility(merchantData);

      // Update merchant verification record in the database
      const updateFields = {
        aiVerificationStatus: verificationResult.eligible ? 'approved' : 'rejected',
        aiVerificationScore: verificationResult.score,
        aiVerificationDetails: JSON.stringify(verificationResult.verificationDetails),
        aiVerificationRecommendations: JSON.stringify(verificationResult.recommendations),
        aiVerificationDate: new Date()
      };

      // Update the merchant record with verification results
      await storage.updateMerchantBusinessDetails(parseInt(merchantId), updateFields);

      logger.info({
        message: `Completed AI-powered merchant verification: ${verificationResult.eligible ? 'Approved' : 'Rejected'}`,
        category: "api",
        source: "openai",
        metadata: {
          merchantId,
          eligible: verificationResult.eligible,
          score: verificationResult.score,
          businessName: businessInfo.businessName || "Unknown"
        }
      });

      return res.status(200).json({
        success: true,
        verificationResult
      });
    } catch (error) {
      logger.error({
        message: `Error verifying merchant eligibility: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "openai",
        metadata: {
          error: error instanceof Error ? error.stack : String(error),
          requestBody: req.body
        }
      });

      return res.status(500).json({
        success: false,
        message: "Failed to verify merchant eligibility",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }
};