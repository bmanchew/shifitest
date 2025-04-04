import { Router } from 'express';
import { merchantVerificationController } from '../controllers/merchantVerification.controller';

const router = Router();

// Endpoint to verify merchant eligibility using AI
router.post('/verify-eligibility', merchantVerificationController.verifyMerchantEligibility);

export default router;