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
  },

  /**
   * Analyze merchant financials using plaid data and AI models
   */
  async analyzeMerchantFinancials(req: Request, res: Response) {
    try {
      const { merchantId } = req.body;

      if (!merchantId) {
        return res.status(400).json({
          success: false,
          message: "Merchant ID is required"
        });
      }

      logger.info({
        message: "Starting AI-powered merchant financial analysis",
        category: "api",
        source: "openai",
        metadata: { 
          merchantId
        }
      });

      // First check if OpenAI service is initialized
      if (!openaiService.isInitialized()) {
        logger.error({
          message: "OpenAI service not initialized for merchant financial analysis",
          category: "api",
          source: "openai",
          metadata: { 
            merchantId
          }
        });

        return res.status(503).json({
          success: false,
          message: "AI analysis service is not available. Please try again later."
        });
      }

      // Get merchant information
      const merchant = await storage.getMerchant(parseInt(merchantId));
      if (!merchant) {
        return res.status(404).json({
          success: false,
          message: "Merchant not found"
        });
      }

      // Retrieve Plaid connection data
      const plaidMerchant = await storage.getPlaidMerchantByMerchantId(parseInt(merchantId));
      if (!plaidMerchant) {
        return res.status(404).json({
          success: false,
          message: "Plaid merchant connection not found"
        });
      }

      // Fetch account and transaction data from Plaid
      const accounts = await plaidService.getAccounts(plaidMerchant.accessToken);
      
      // Calculate financial metrics
      const balanceSum = accounts.reduce((sum, account) => {
        // Only include checking and savings accounts
        if (account.type === 'depository' && 
           (account.subtype === 'checking' || account.subtype === 'savings')) {
          return sum + (account.balances.available || account.balances.current || 0);
        }
        return sum;
      }, 0);

      // Prepare financial data for analysis
      const financialData = {
        accounts,
        balanceSum,
        accountCount: accounts.length,
        merchantName: merchant.name,
        merchantId: merchant.id
      };

      // Perform AI analysis on the financial data
      const analysisResult = await openaiService.generateFinancialInsights(financialData);
      
      // Format the response
      const formattedAnalysis = {
        merchantId: merchant.id,
        merchantName: merchant.name,
        accountSummary: {
          totalAccounts: accounts.length,
          totalBalance: balanceSum,
          accountTypes: accounts.map(a => a.type).filter((v, i, a) => a.indexOf(v) === i)
        },
        aiInsights: analysisResult,
        analysisDate: new Date()
      };

      // Store the analysis results
      const businessDetails = await storage.getMerchantBusinessDetailsByMerchantId(parseInt(merchantId));
      if (businessDetails) {
        await storage.updateMerchantBusinessDetails(businessDetails.id, {
          aiVerificationDetails: JSON.stringify(formattedAnalysis)
        });
      }

      logger.info({
        message: "Completed AI-powered merchant financial analysis",
        category: "api",
        source: "openai",
        metadata: { 
          merchantId,
          insightsCount: analysisResult.length,
          plaidMerchantId: plaidMerchant.id
        }
      });

      return res.status(200).json({
        success: true,
        analysis: formattedAnalysis
      });
    } catch (error) {
      logger.error({
        message: `Error analyzing merchant financials: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "openai",
        metadata: {
          error: error instanceof Error ? error.stack : String(error),
          requestBody: req.body
        }
      });

      return res.status(500).json({
        success: false,
        message: "Failed to analyze merchant financials",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  },

  /**
   * Get verification status and details for a merchant
   */
  async getVerificationStatus(req: Request, res: Response) {
    try {
      const merchantId = parseInt(req.params.merchantId);

      if (isNaN(merchantId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid merchant ID"
        });
      }

      logger.info({
        message: "Fetching merchant verification status",
        category: "api",
        source: "internal",
        metadata: { merchantId }
      });

      // Get merchant and business details
      const merchant = await storage.getMerchant(merchantId);
      if (!merchant) {
        return res.status(404).json({
          success: false,
          message: "Merchant not found"
        });
      }

      const businessDetails = await storage.getMerchantBusinessDetailsByMerchantId(merchantId);
      
      // Format the response with verification data
      const verificationData = {
        merchantId,
        merchantName: merchant.name,
        verificationStatus: businessDetails?.verificationStatus || 'not_started',
        aiVerificationStatus: businessDetails?.aiVerificationStatus || null,
        aiVerificationScore: businessDetails?.aiVerificationScore || null,
        aiVerificationDate: businessDetails?.aiVerificationDate || null,
        aiVerificationDetails: businessDetails?.aiVerificationDetails 
          ? JSON.parse(businessDetails.aiVerificationDetails) 
          : null,
        aiVerificationRecommendations: businessDetails?.aiVerificationRecommendations 
          ? JSON.parse(businessDetails.aiVerificationRecommendations) 
          : null,
        adminReviewed: !!businessDetails?.adminReviewedAt,
        adminReviewDate: businessDetails?.adminReviewedAt || null
      };

      return res.status(200).json({
        success: true,
        verificationData
      });
    } catch (error) {
      logger.error({
        message: `Error getting verification status: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "internal",
        metadata: {
          error: error instanceof Error ? error.stack : String(error),
          merchantId: req.params.merchantId
        }
      });

      return res.status(500).json({
        success: false,
        message: "Failed to get verification status",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }
};