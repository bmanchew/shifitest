import express from "express";
import { authenticateAdmin } from "../../middleware/auth";
import { PlaidUnderwritingService } from "../../services/plaidUnderwriting";
import { storage } from "../../storage";
import { logger } from "../../services/logger";
import axios from "axios";

const router = express.Router();
const plaidUnderwritingService = new PlaidUnderwritingService(storage);

/**
 * Get the latest underwriting analysis for a merchant
 */
router.get("/:merchantId/latest-analysis", authenticateAdmin, async (req, res) => {
  try {
    const merchantId = parseInt(req.params.merchantId);
    
    if (isNaN(merchantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid merchant ID"
      });
    }
    
    // Check if the merchant exists
    const merchant = await storage.getMerchant(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found"
      });
    }
    
    // Try to get existing analysis
    let analysis = await plaidUnderwritingService.getLatestAnalysisForMerchant(merchantId);
    
    if (!analysis) {
      // If no analysis exists, try to generate one from the latest asset report
      const assetReports = await storage.getAssetReportsByUserId(merchant.userId);
      
      if (!assetReports || assetReports.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No asset reports found for this merchant"
        });
      }
      
      // Get the latest asset report
      const latestReport = assetReports.sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
      
      if (latestReport.status !== 'ready') {
        return res.status(400).json({
          success: false,
          message: `Latest asset report is not ready (status: ${latestReport.status})`
        });
      }
      
      // Fetch the asset report data from Plaid
      const reportResponse = await axios.get(`/api/plaid/asset-report/${latestReport.assetReportId}`);
      
      if (!reportResponse.data.success) {
        return res.status(500).json({
          success: false,
          message: "Failed to fetch asset report data from Plaid"
        });
      }
      
      // Generate the analysis
      analysis = await plaidUnderwritingService.generateUnderwritingAnalysis(
        merchantId,
        latestReport.assetReportId,
        reportResponse.data.assetReport
      );
    }
    
    return res.json({
      success: true,
      analysis
    });
  } catch (error) {
    logger.error(`Error getting latest underwriting analysis: ${error instanceof Error ? error.message : String(error)}`);
    
    return res.status(500).json({
      success: false,
      message: "An error occurred while getting the underwriting analysis"
    });
  }
});

/**
 * Get underwriting analysis for a specific asset report
 */
router.get("/:merchantId/analysis/:assetReportId", authenticateAdmin, async (req, res) => {
  try {
    const merchantId = parseInt(req.params.merchantId);
    const assetReportId = req.params.assetReportId;
    
    if (isNaN(merchantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid merchant ID"
      });
    }
    
    // Check if the merchant exists
    const merchant = await storage.getMerchant(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found"
      });
    }
    
    // Try to get existing analysis
    let analysis = await plaidUnderwritingService.getAnalysisForAssetReport(merchantId, assetReportId);
    
    if (!analysis) {
      // If no analysis exists, try to generate one
      const assetReport = await storage.getAssetReportById(parseInt(assetReportId));
      
      if (!assetReport || assetReport.userId !== merchant.userId) {
        return res.status(404).json({
          success: false,
          message: "Asset report not found for this merchant"
        });
      }
      
      if (assetReport.status !== 'ready') {
        return res.status(400).json({
          success: false,
          message: `Asset report is not ready (status: ${assetReport.status})`
        });
      }
      
      // Fetch the asset report data from Plaid
      const reportResponse = await axios.get(`/api/plaid/asset-report/${assetReportId}`);
      
      if (!reportResponse.data.success) {
        return res.status(500).json({
          success: false,
          message: "Failed to fetch asset report data from Plaid"
        });
      }
      
      // Generate the analysis
      analysis = await plaidUnderwritingService.generateUnderwritingAnalysis(
        merchantId,
        assetReportId,
        reportResponse.data.assetReport
      );
    }
    
    return res.json({
      success: true,
      analysis
    });
  } catch (error) {
    logger.error(`Error getting underwriting analysis: ${error instanceof Error ? error.message : String(error)}`);
    
    return res.status(500).json({
      success: false,
      message: "An error occurred while getting the underwriting analysis"
    });
  }
});

/**
 * Generate a new underwriting analysis for an asset report
 */
router.post("/:merchantId/generate-analysis/:assetReportId", authenticateAdmin, async (req, res) => {
  try {
    const merchantId = parseInt(req.params.merchantId);
    const assetReportId = req.params.assetReportId;
    
    if (isNaN(merchantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid merchant ID"
      });
    }
    
    // Check if the merchant exists
    const merchant = await storage.getMerchant(merchantId);
    if (!merchant) {
      return res.status(404).json({
        success: false,
        message: "Merchant not found"
      });
    }
    
    // Check if the asset report exists and belongs to this merchant
    const assetReport = await storage.getAssetReportById(parseInt(assetReportId));
    
    if (!assetReport || assetReport.userId !== merchant.userId) {
      return res.status(404).json({
        success: false,
        message: "Asset report not found for this merchant"
      });
    }
    
    if (assetReport.status !== 'ready') {
      return res.status(400).json({
        success: false,
        message: `Asset report is not ready (status: ${assetReport.status})`
      });
    }
    
    // Fetch the asset report data from Plaid
    const reportResponse = await axios.get(`/api/plaid/asset-report/${assetReportId}`);
    
    if (!reportResponse.data.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch asset report data from Plaid"
      });
    }
    
    // Generate the analysis
    const analysis = await plaidUnderwritingService.generateUnderwritingAnalysis(
      merchantId,
      assetReportId,
      reportResponse.data.assetReport
    );
    
    return res.json({
      success: true,
      analysis
    });
  } catch (error) {
    logger.error(`Error generating underwriting analysis: ${error instanceof Error ? error.message : String(error)}`);
    
    return res.status(500).json({
      success: false,
      message: "An error occurred while generating the underwriting analysis"
    });
  }
});

export default router;