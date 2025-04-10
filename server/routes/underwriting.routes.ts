/**
 * Underwriting Routes
 * 
 * Routes for retrieving and managing underwriting data
 */
import { Router, Request, Response } from 'express';
import { isAuthenticated } from '../middleware/auth';
import { storage } from '../storage';
import { logger } from '../services/logger';

const router = Router();

/**
 * @route GET /api/underwriting
 * @desc Get underwriting data for a contract
 * @access Private - Auth required
 */
router.get('/', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { contractId } = req.query;
    
    if (!contractId) {
      return res.status(400).json({
        success: false,
        message: "Contract ID is required"
      });
    }
    
    const contractIdNum = parseInt(contractId as string);
    
    if (isNaN(contractIdNum)) {
      return res.status(400).json({
        success: false,
        message: "Invalid contract ID format"
      });
    }
    
    // Verify the contract exists
    const contract = await storage.getContract(contractIdNum);
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Contract not found"
      });
    }
    
    // Fetch all underwriting data for this contract
    const underwritingData = await storage.getUnderwritingDataByContractId(contractIdNum);
    
    // Check user authorization - admin or merchant that owns the contract
    if (req.user) {
      if (req.user.role === 'admin') {
        // Admin can see all data
      } else if (req.user.role === 'merchant') {
        const merchant = await storage.getMerchantByUserId(req.user.id);
        if (!merchant || merchant.id !== contract.merchantId) {
          return res.status(403).json({
            success: false,
            message: "Not authorized to view underwriting data for this contract"
          });
        }
      } else {
        // Other roles not allowed
        return res.status(403).json({
          success: false,
          message: "Not authorized to access underwriting data"
        });
      }
    } else {
      // No user in request
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }
    
    if (!underwritingData) {
      return res.status(404).json({
        success: false,
        message: "No underwriting data found for this contract"
      });
    }
    
    // Format the response with all required data
    // Include key underwriting metrics for analysis
    const formattedData = {
      contractId: contractIdNum,
      contractNumber: contract.contractNumber,
      underwritingStatus: contract.underwritingStatus || 'pending',
      creditTier: underwritingData.creditTier,
      creditScore: underwritingData.creditScore,
      annualIncome: underwritingData.annualIncome,
      employmentHistoryMonths: underwritingData.employmentHistoryMonths,
      debtToIncomeRatio: underwritingData.debtToIncomeRatio,
      totalPoints: getTotalUnderwritingPoints(underwritingData),
      decision: getUnderwritingDecision(underwritingData),
      details: {
        creditScorePoints: underwritingData.creditScorePoints,
        annualIncomePoints: underwritingData.annualIncomePoints,
        employmentHistoryPoints: underwritingData.employmentHistoryPoints,
        debtToIncomePoints: underwritingData.debtToIncomePoints,
        bankBalancePoints: underwritingData.bankBalancePoints,
        bankHistoryPoints: underwritingData.bankHistoryPoints,
        businessHistoryPoints: underwritingData.businessHistoryPoints
      },
      createdAt: underwritingData.createdAt,
      updatedAt: underwritingData.updatedAt
    };
    
    return res.json({
      success: true,
      data: formattedData
    });
    
  } catch (error) {
    logger.error({
      message: `Error retrieving underwriting data: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'internal',
      metadata: {
        contractId: req.query.contractId,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve underwriting data"
    });
  }
});

/**
 * Calculate total underwriting points from all categories
 */
function getTotalUnderwritingPoints(underwritingData: any): number {
  let total = 0;
  
  // Add all points categories
  total += underwritingData.creditScorePoints || 0;
  total += underwritingData.annualIncomePoints || 0;
  total += underwritingData.employmentHistoryPoints || 0;
  total += underwritingData.debtToIncomePoints || 0;
  total += underwritingData.bankBalancePoints || 0;
  total += underwritingData.bankHistoryPoints || 0;
  total += underwritingData.businessHistoryPoints || 0;
  
  return total;
}

/**
 * Determine underwriting decision based on total points and criteria
 */
function getUnderwritingDecision(underwritingData: any): string {
  const totalPoints = getTotalUnderwritingPoints(underwritingData);
  
  // Decision thresholds
  if (totalPoints >= 80) {
    return 'Approved';
  } else if (totalPoints >= 60) {
    return 'Conditionally Approved';
  } else if (totalPoints >= 40) {
    return 'Manual Review Required';
  } else {
    return 'Declined';
  }
}

export default router;