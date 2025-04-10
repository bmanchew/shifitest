/**
 * Contract Status Routes
 * 
 * Routes for retrieving contract application status and progress
 */
import { Router, Request, Response } from 'express';
import { isAuthenticated } from '../middleware/auth';
import { storage } from '../storage';
import { logger } from '../services/logger';

const router = Router();

/**
 * @route GET /api/contracts/:id/status
 * @desc Get application status steps for a contract
 * @access Private - Auth required
 */
router.get('/:id/status', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const contractId = parseInt(req.params.id);
    
    if (isNaN(contractId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid contract ID format"
      });
    }
    
    // Fetch the contract to ensure it exists
    const contract = await storage.getContract(contractId);
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: "Contract not found"
      });
    }
    
    // Get application progress steps for this contract
    const applicationProgress = await storage.getApplicationProgressByContractId(contractId);
    
    // Get all completed steps in the application process
    const completedVerifications = await storage.getCompletedContractVerificationSteps(contractId);
    
    // Format the response with all application steps and their status
    const statusSteps = applicationProgress.map(step => ({
      step: step.step,
      completed: step.completed,
      completedAt: step.completedAt,
      description: getStepDescription(step.step),
      order: getStepOrder(step.step)
    }));
    
    // Add any additional verification steps that might not be in the progress table
    completedVerifications.forEach(verification => {
      if (!statusSteps.some(step => step.step === verification.step)) {
        statusSteps.push({
          step: verification.step,
          completed: true,
          completedAt: verification.completedAt,
          description: getStepDescription(verification.step),
          order: getStepOrder(verification.step)
        });
      }
    });
    
    // Sort steps by their order for consistent display
    const sortedSteps = statusSteps.sort((a, b) => a.order - b.order);
    
    // Return success with the current application status
    return res.json({
      success: true,
      contractId,
      contractNumber: contract.contractNumber,
      currentStep: contract.currentStep,
      status: contract.status,
      steps: sortedSteps
    });
    
  } catch (error) {
    logger.error({
      message: `Error fetching contract status: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'internal',
      metadata: {
        contractId: req.params.id,
        error: error instanceof Error ? error.stack : String(error)
      }
    });
    
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve contract status"
    });
  }
});

// Helper function to get a human-readable description for each step
function getStepDescription(step: string): string {
  const descriptions: Record<string, string> = {
    'terms': 'Terms and Conditions acceptance',
    'kyc': 'Identity verification',
    'bank': 'Bank account connection',
    'bank_pending': 'Bank account verification pending',
    'payment': 'Payment setup',
    'signing': 'Contract signing',
    'completed': 'Application completed'
  };
  
  return descriptions[step] || `Step: ${step}`;
}

// Helper function to determine the order of steps for display
function getStepOrder(step: string): number {
  const order: Record<string, number> = {
    'terms': 1,
    'kyc': 2,
    'bank': 3,
    'bank_pending': 3.5,
    'payment': 4,
    'signing': 5,
    'completed': 6
  };
  
  return order[step] || 99;
}

export default router;