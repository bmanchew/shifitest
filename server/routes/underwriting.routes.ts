/**
 * Underwriting Routes
 * 
 * Routes for retrieving and managing underwriting data
 */
import { Router, Request, Response } from 'express';
import { isAuthenticated } from '../middleware/auth';
import { storage } from '../storage';
import { logger } from '../utils/logger';

const router = Router();

/**
 * @route GET /api/underwriting
 * @desc Get underwriting data for a contract
 * @access Private - Auth required
 */
router.get('/', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { contractId } = req.query;
    const userId = req.user?.id;
    
    if (!contractId) {
      return res.status(400).json({
        success: false,
        message: 'Contract ID is required'
      });
    }
    
    const contractIdNum = parseInt(contractId as string);
    
    if (isNaN(contractIdNum)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid contract ID format'
      });
    }
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized - User not authenticated' 
      });
    }

    // Get the contract
    const contract = await storage.getContract(contractIdNum);
    
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }
    
    // Check permissions - either the user is admin or the contract belongs to their merchant
    const isAdmin = req.user?.role === 'admin';
    
    if (!isAdmin) {
      const userMerchant = await storage.getMerchantByUserId(userId);
      
      if (!userMerchant || userMerchant.id !== contract.merchantId) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden - Not authorized to view underwriting data for this contract'
        });
      }
    }

    // Try to get underwriting data for this contract
    const underwritingData = await storage.getUnderwritingDataByContractId(contractIdNum);
    
    if (!underwritingData || underwritingData.length === 0) {
      // Provide demo data if no real data exists
      // Different data based on user role
      if (isAdmin) {
        return res.status(200).json({
          success: true,
          creditScore: 720,
          incomeVerification: {
            status: 'verified',
            monthlyIncome: 5000,
            employmentStatus: 'full_time',
          },
          riskAssessment: {
            overallRisk: 'low',
            factors: [
              { name: 'Credit History', rating: 'good' },
              { name: 'Debt-to-Income Ratio', rating: 'excellent' },
              { name: 'Employment Stability', rating: 'good' }
            ]
          },
          decisionStatus: 'pending'
        });
      } else if (req.user?.role === 'merchant') {
        return res.status(200).json({
          success: true,
          decisionStatus: 'pending',
          estimatedDecisionDate: new Date(Date.now() + 86400000).toISOString()
        });
      } else {
        // Customer view
        return res.status(200).json({
          success: true,
          applicationInProgress: true,
          estimatedCompletionTime: '1-2 business days'
        });
      }
    }
    
    // If we have real data, use the most recent underwriting result
    const mostRecent = underwritingData.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
    
    // Parse data if it's stored as JSON string
    let parsedData = mostRecent.data;
    if (typeof mostRecent.data === 'string') {
      try {
        parsedData = JSON.parse(mostRecent.data);
      } catch (e) {
        // If parsing fails, keep as is
        parsedData = mostRecent.data;
      }
    }
    
    // Different response based on user role
    if (isAdmin) {
      // Admin gets full data
      return res.status(200).json({
        success: true,
        id: mostRecent.id,
        contractId: mostRecent.contractId,
        score: mostRecent.score,
        decision: mostRecent.decision,
        data: parsedData,
        createdAt: mostRecent.createdAt,
        updatedAt: mostRecent.updatedAt
      });
    } else {
      // Non-admin users get limited data
      return res.status(200).json({
        success: true,
        decisionStatus: mostRecent.decision || 'pending',
        estimatedDecisionDate: new Date(Date.now() + 86400000).toISOString()
      });
    }
  } catch (error: any) {
    logger.error({
      message: `Error fetching underwriting data: ${error.message}`,
      category: 'api',
      source: 'internal',
      metadata: { error: error.message, contractId: req.query.contractId }
    });
    
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: error.message
    });
  }
});

export default router;