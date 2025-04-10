/**
 * Contract Status Routes
 * 
 * Routes for retrieving contract application status and progress
 */
import { Router, Request, Response } from 'express';
import { isAuthenticated } from '../middleware/auth';
import { storage } from '../storage';
import { logger } from '../utils/logger';

const router = Router();

/**
 * @route GET /api/contracts/:id/status
 * @desc Get application status steps for a contract
 * @access Private - Auth required
 */
router.get('/:id/status', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const contractId = parseInt(req.params.id);
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized - User not authenticated' 
      });
    }

    // Get the contract
    const contract = await storage.getContract(contractId);
    
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
          message: 'Forbidden - Not authorized to view this contract status'
        });
      }
    }

    // Get application progress for this contract
    const progressData = await storage.getApplicationProgressByContractId(contractId);
    
    // Transform progress data into status steps
    const steps = progressData.map((progress, index) => ({
      id: progress.id.toString(),
      name: progress.step.charAt(0).toUpperCase() + progress.step.slice(1).replace(/_/g, ' '),
      status: progress.completed ? 'completed' : 'pending',
      completedAt: progress.completedAt ? progress.completedAt.toISOString() : undefined
    }));
    
    // If no progress data exists, return default steps
    const defaultSteps = steps.length > 0 ? steps : [
      { id: '1', name: 'Application Submitted', status: 'completed', completedAt: new Date().toISOString() },
      { id: '2', name: 'Identity Verification', status: 'pending' },
      { id: '3', name: 'Underwriting Review', status: 'pending' },
      { id: '4', name: 'Contract Signing', status: 'pending' },
      { id: '5', name: 'Bank Account Verification', status: 'pending' }
    ];
    
    res.status(200).json({
      success: true,
      steps: defaultSteps
    });
  } catch (error: any) {
    logger.error({
      message: `Error fetching contract status: ${error.message}`,
      category: 'api',
      source: 'internal',
      metadata: { error: error.message, contractId: req.params.id }
    });
    
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: error.message
    });
  }
});

export default router;