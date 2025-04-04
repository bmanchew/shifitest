import { Router } from 'express';
import { merchantVerificationController } from '../controllers/merchantVerification.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Endpoints for AI-powered merchant verification
router.post('/verify-eligibility', merchantVerificationController.verifyMerchantEligibility);
router.post('/analyze-financials', merchantVerificationController.analyzeMerchantFinancials);
router.get('/status/:merchantId', authenticateToken, merchantVerificationController.getVerificationStatus);

export default router;