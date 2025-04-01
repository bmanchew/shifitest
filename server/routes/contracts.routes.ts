/**
 * Contracts Routes
 * 
 * Routes for managing merchant financing contracts
 */
import { Router, Request, Response } from 'express';
import { isAuthenticated } from '../middleware/auth';
import { storage } from '../storage';
import { Contract } from '../../shared/schema';

const router = Router();

/**
 * @route GET /api/contracts
 * @desc Get contracts with admin support (all contracts) or filtered by merchantId
 * @access Private - Auth required, Admin role required for admin=true
 */
router.get('/', isAuthenticated, async (req: Request, res: Response) => {
  try {
    console.log('GET /api/contracts - Request received:', {
      query: req.query,
      user: { id: req.user?.id, role: req.user?.role, merchantId: req.user?.merchantId }
    });
    
    const userId = req.user?.id;
    if (!userId) {
      console.log('GET /api/contracts - Unauthorized: No user ID in request');
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized - User not authenticated' 
      });
    }

    // Check for admin query param - this requires admin permissions
    const isAdminRequest = req.query.admin === 'true';
    
    // Check for merchantId query parameter
    const merchantIdParam = req.query.merchantId ? parseInt(req.query.merchantId as string) : undefined;
    console.log(`GET /api/contracts - Query parameters: isAdminRequest=${isAdminRequest}, merchantIdParam=${merchantIdParam}`);
    
    // If admin request, verify admin permissions
    if (isAdminRequest) {
      // Check if user has admin role
      if (req.user?.role !== 'admin') {
        console.log('GET /api/contracts - Forbidden: User is not an admin');
        return res.status(403).json({ 
          success: false,
          message: 'Forbidden - Admin permission required' 
        });
      }
      
      console.log('GET /api/contracts - Processing admin request');
      
      // Admin can view all contracts or filtered by merchantId
      if (merchantIdParam) {
        console.log(`GET /api/contracts - Admin requesting contracts for merchant ID ${merchantIdParam}`);
        const contracts = await storage.getContractsByMerchantId(merchantIdParam);
        console.log(`GET /api/contracts - Retrieved ${contracts.length} contracts for merchant ID ${merchantIdParam}`);
        
        // Add credit tier info to each contract
        console.log('GET /api/contracts - Adding credit tier information to contracts');
        const contractsWithTiers = await Promise.all(contracts.map(async (contract) => {
          const underwritingData = await storage.getUnderwritingDataByContractId(contract.id);
          // Use the most recent underwriting data if available
          const mostRecentUnderwriting = underwritingData.length > 0 ? 
            underwritingData.sort((a, b) => 
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )[0] : null;
          
          return {
            ...contract,
            creditTier: mostRecentUnderwriting?.creditTier || null
          };
        }));
        
        console.log(`GET /api/contracts - Returning ${contractsWithTiers.length} contracts with credit tiers`);
        return res.status(200).json(contractsWithTiers);
      } else {
        // Admin requesting all contracts
        console.log('GET /api/contracts - Admin requesting all contracts');
        const contracts = await storage.getAllContracts();
        console.log(`GET /api/contracts - Retrieved ${contracts.length} contracts total`);
        return res.status(200).json(contracts);
      }
    }
    
    // For non-admin users with merchantId parameter
    if (merchantIdParam) {
      console.log(`GET /api/contracts - Non-admin user requesting contracts for merchant ID ${merchantIdParam}`);
      
      // Verify that the user has access to this merchant
      const userMerchant = await storage.getMerchantByUserId(userId);
      console.log(`GET /api/contracts - User's merchant: ${userMerchant?.id || 'not found'}`);
      
      if (!userMerchant) {
        console.log('GET /api/contracts - Merchant not found for this user');
        return res.status(404).json({
          success: false,
          message: 'Merchant not found for this user'
        });
      }
      
      // Check if the user has access to the requested merchant
      if (userMerchant.id !== merchantIdParam && req.user?.role !== 'admin') {
        console.log(`GET /api/contracts - Forbidden: User's merchant (${userMerchant.id}) does not match requested merchant ID (${merchantIdParam})`);
        return res.status(403).json({
          success: false,
          message: 'Forbidden - Not authorized to view contracts for this merchant'
        });
      }
      
      // Get contracts for the merchant
      console.log(`GET /api/contracts - Fetching contracts for merchant ID ${merchantIdParam}`);
      const contracts = await storage.getContractsByMerchantId(merchantIdParam);
      console.log(`GET /api/contracts - Retrieved ${contracts.length} contracts for merchant ID ${merchantIdParam}`);
      
      // Add credit tier info to each contract
      console.log('GET /api/contracts - Adding credit tier information to contracts');
      const contractsWithTiers = await Promise.all(contracts.map(async (contract) => {
        const underwritingData = await storage.getUnderwritingDataByContractId(contract.id);
        // Use the most recent underwriting data if available
        const mostRecentUnderwriting = underwritingData.length > 0 ? 
          underwritingData.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )[0] : null;
        
        return {
          ...contract,
          creditTier: mostRecentUnderwriting?.creditTier || null
        };
      }));
      
      console.log(`GET /api/contracts - Returning ${contractsWithTiers.length} contracts with credit tiers`);
      return res.status(200).json(contractsWithTiers);
    }
    
    // Regular users with no merchantId - use their own merchant
    console.log('GET /api/contracts - No merchantId provided, using user\'s merchant');
    const userMerchant = await storage.getMerchantByUserId(userId);
    console.log(`GET /api/contracts - User's merchant: ${userMerchant?.id || 'not found'}`);
    
    if (!userMerchant) {
      console.log('GET /api/contracts - Merchant not found for this user');
      return res.status(404).json({
        success: false,
        message: 'Merchant not found for this user'
      });
    }
    
    console.log(`GET /api/contracts - Fetching contracts for user's merchant ID ${userMerchant.id}`);
    const contracts = await storage.getContractsByMerchantId(userMerchant.id);
    console.log(`GET /api/contracts - Retrieved ${contracts.length} contracts for merchant ID ${userMerchant.id}`);
    
    // Add credit tier info to each contract
    console.log('GET /api/contracts - Adding credit tier information to contracts');
    const contractsWithTiers = await Promise.all(contracts.map(async (contract) => {
      const underwritingData = await storage.getUnderwritingDataByContractId(contract.id);
      // Use the most recent underwriting data if available
      const mostRecentUnderwriting = underwritingData.length > 0 ? 
        underwritingData.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0] : null;
      
      return {
        ...contract,
        creditTier: mostRecentUnderwriting?.creditTier || null
      };
    }));
    
    console.log(`GET /api/contracts - Returning ${contractsWithTiers.length} contracts with credit tiers`);
    res.status(200).json(contractsWithTiers);
  } catch (error: any) {
    console.error('Error fetching contracts:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * @route GET /api/contracts/:id
 * @desc Get a specific contract by ID
 * @access Private - Auth required
 */
router.get('/:id', isAuthenticated, async (req: Request, res: Response) => {
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
          message: 'Forbidden - Not authorized to view this contract'
        });
      }
    }
    
    // Fetch related data for the contract
    const merchant = await storage.getMerchant(contract.merchantId);
    
    // Get underwriting details if present
    let underwritingDetails = null;
    if (contract.id) {
      const underwritingResult = await storage.getUnderwritingByContractId(contract.id);
      if (underwritingResult) {
        underwritingDetails = {
          ...underwritingResult,
          // Format dates for consistent API response
          createdAt: underwritingResult.createdAt ? new Date(underwritingResult.createdAt) : null,
          updatedAt: underwritingResult.updatedAt ? new Date(underwritingResult.updatedAt) : null,
        };
      }
    }
    
    res.status(200).json({
      ...contract,
      merchant: merchant ? {
        id: merchant.id,
        name: merchant.name,
        email: merchant.email,
        phone: merchant.phone,
        address: merchant.address,
        contactName: merchant.contactName
      } : null,
      underwriting: underwritingDetails
    });
  } catch (error: any) {
    console.error('Error fetching contract details:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: error.message
    });
  }
});

export default router;