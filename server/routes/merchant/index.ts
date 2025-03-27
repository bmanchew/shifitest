import { Router } from 'express';
import { getMerchantAnalytics, getContractSummary, getMerchantContracts } from './analytics';
import { getMerchantFunding, getFundingTransferDetails } from './funding';
import { authenticateToken, canAccessMerchantData } from '../../middleware/auth';

const router = Router();

// Apply authentication to all merchant routes
router.use(authenticateToken);

// Analytics routes
router.get('/:id/analytics', canAccessMerchantData, getMerchantAnalytics);
router.get('/:id/contract-summary', canAccessMerchantData, getContractSummary);
router.get('/:id/contracts', canAccessMerchantData, getMerchantContracts);

// Funding routes
router.get('/:id/funding', canAccessMerchantData, getMerchantFunding);
router.get('/:merchantId/funding/:transferId', canAccessMerchantData, getFundingTransferDetails);

export default router;