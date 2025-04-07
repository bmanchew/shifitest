import { Router } from 'express';
import { dueDiligenceService } from '../../services/dueDiligence';
import { storage } from '../../storage';
import { authenticateAdmin } from '../../middleware/auth';
import { logger } from '../../services/logger';

const router = Router();

/**
 * Route for generating a due diligence report for a merchant
 * This uses OpenAI GPT-4.5 to analyze merchant data and generate
 * a comprehensive investment and compliance risk analysis
 */
router.post('/generate/:merchantId', authenticateAdmin, async (req, res) => {
  const { merchantId } = req.params;
  
  if (!merchantId) {
    return res.status(400).json({ 
      success: false, 
      error: 'Merchant ID is required' 
    });
  }

  try {
    // Get complete merchant data
    const merchant = await storage.getMerchant(parseInt(merchantId, 10));
    
    if (!merchant) {
      return res.status(404).json({ 
        success: false, 
        error: 'Merchant not found' 
      });
    }
    
    // Get merchant verification information if available
    const verificationInfo = await storage.getMerchantVerificationInfo(parseInt(merchantId, 10));
    
    // Get contract info
    const contracts = await storage.getContractsByMerchantId(parseInt(merchantId, 10));
    
    // Enrich merchant data with additional information for report
    const enrichedMerchantData = {
      ...merchant,
      verificationStatus: verificationInfo?.status || 'unverified',
      middeskBusinessId: verificationInfo?.middeskBusinessId || null,
      activeContractsCount: contracts.filter(c => c.status === 'active').length,
      totalContractsValue: contracts
        .filter(c => c.status === 'active')
        .reduce((sum, contract) => sum + (contract.amount || 0), 0),
      // Determine risk score based on available data
      riskScore: determineRiskScore(merchant, contracts, verificationInfo)
    };

    // Generate the due diligence report
    const reportResult = await dueDiligenceService.generateDueDiligenceReport(enrichedMerchantData);
    
    if (!reportResult.success) {
      return res.status(500).json(reportResult);
    }
    
    // Save the report in the database for future reference
    const savedReport = await storage.saveDueDiligenceReport({
      merchantId: parseInt(merchantId, 10),
      report: reportResult.report!,
      generatedAt: reportResult.generatedAt!,
      generatedBy: req.user!.id,
      status: 'completed'
    });
    
    return res.status(200).json({
      success: true,
      report: reportResult.report,
      reportId: savedReport.id,
      generatedAt: reportResult.generatedAt
    });
  } catch (error) {
    logger.error({
      message: `Error generating due diligence report: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'internal',
      metadata: {
        merchantId,
        userId: req.user?.id,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to generate due diligence report'
    });
  }
});

/**
 * Get all due diligence reports for a merchant
 */
router.get('/:merchantId', authenticateAdmin, async (req, res) => {
  const { merchantId } = req.params;
  
  try {
    const reports = await storage.getDueDiligenceReportsByMerchantId(parseInt(merchantId, 10));
    
    return res.status(200).json({
      success: true,
      reports: reports.map(report => ({
        id: report.id,
        merchantId: report.merchantId,
        generatedAt: report.generatedAt,
        generatedBy: report.generatedBy,
        status: report.status,
        summary: report.report.substring(0, 200) + '...' // Just provide a preview
      }))
    });
  } catch (error) {
    logger.error({
      message: `Error retrieving due diligence reports: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'internal',
      metadata: {
        merchantId,
        userId: req.user?.id,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve due diligence reports'
    });
  }
});

/**
 * Get a specific due diligence report by ID
 */
router.get('/report/:reportId', authenticateAdmin, async (req, res) => {
  const { reportId } = req.params;
  
  try {
    const report = await storage.getDueDiligenceReportById(parseInt(reportId, 10));
    
    if (!report) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      report
    });
  } catch (error) {
    logger.error({
      message: `Error retrieving due diligence report: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'internal',
      metadata: {
        reportId,
        userId: req.user?.id,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve due diligence report'
    });
  }
});

/**
 * Delete a due diligence report
 */
router.delete('/report/:reportId', authenticateAdmin, async (req, res) => {
  const { reportId } = req.params;
  
  try {
    await storage.deleteDueDiligenceReport(parseInt(reportId, 10));
    
    return res.status(200).json({
      success: true,
      message: 'Report deleted successfully'
    });
  } catch (error) {
    logger.error({
      message: `Error deleting due diligence report: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'internal',
      metadata: {
        reportId,
        userId: req.user?.id,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      error: 'Failed to delete due diligence report'
    });
  }
});

/**
 * Helper function to determine a merchant's risk score
 * based on available data
 */
function determineRiskScore(merchant: any, contracts: any[], verificationInfo: any): 'low' | 'medium' | 'high' {
  // Basic risk assessment heuristics
  let riskFactors = 0;
  
  // Verification status
  if (!verificationInfo || verificationInfo.status !== 'verified') {
    riskFactors += 2; // High risk factor for unverified merchants
  }
  
  // Contract history
  if (contracts.length === 0) {
    riskFactors += 1; // Moderate risk for no contract history
  }
  
  // Contract payment history
  const hasLatePayments = contracts.some(c => c.paymentStatus === 'late');
  if (hasLatePayments) {
    riskFactors += 2; // High risk for late payments
  }
  
  // Account age
  const accountAge = merchant.createdAt ? 
    Math.floor((new Date().getTime() - new Date(merchant.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30)) : 0; // in months
  
  if (accountAge < 3) {
    riskFactors += 1; // New accounts have moderate risk
  }
  
  // Determine final risk score
  if (riskFactors >= 3) {
    return 'high';
  } else if (riskFactors >= 1) {
    return 'medium';
  } else {
    return 'low';
  }
}

export default router;