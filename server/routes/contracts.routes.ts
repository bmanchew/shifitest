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
      user: { id: req.user?.id, role: req.user?.role }
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
        return res.status(200).json({
          success: true,
          contracts: contractsWithTiers
        });
      } else {
        // Admin requesting all contracts
        console.log('GET /api/contracts - Admin requesting all contracts');
        const contracts = await storage.getAllContracts();
        console.log(`GET /api/contracts - Retrieved ${contracts.length} contracts total`);
        return res.status(200).json({
          success: true,
          contracts: contracts
        });
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
      return res.status(200).json({
        success: true,
        contracts: contractsWithTiers
      });
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
    res.status(200).json({
      success: true,
      contracts: contractsWithTiers
    });
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
      const underwritingResults = await storage.getUnderwritingDataByContractId(contract.id);
      if (underwritingResults && underwritingResults.length > 0) {
        // Use the most recent underwriting data
        const mostRecent = underwritingResults.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];
        
        underwritingDetails = {
          ...mostRecent,
          // Format dates for consistent API response
          createdAt: mostRecent.createdAt ? new Date(mostRecent.createdAt) : null,
          updatedAt: mostRecent.updatedAt ? new Date(mostRecent.updatedAt) : null,
        };
      }
    }
    
    res.status(200).json({
      success: true,
      contract: {
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
      }
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

/**
 * @route GET /api/contracts/:id/underwriting
 * @desc Get underwriting data for a specific contract
 * @access Private - Auth required, permission check for contract access
 */
router.get('/:id/underwriting', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const contractId = parseInt(req.params.id);
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Unauthorized - User not authenticated' 
      });
    }

    // Get the contract to ensure it exists
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
    
    // Get associated underwriting data using the fixed function
    const underwritingData = await storage.getUnderwritingDataByContractId(contractId);

    // If no data found, return empty result
    if (!underwritingData || underwritingData.length === 0) {
      return res.json({
        success: true,
        data: [],
        message: "No underwriting data available for this contract"
      });
    }

    // Filter sensitive data based on role (admin vs others)
    const filteredData = isAdmin ? underwritingData : underwritingData.map(data => ({
      id: data.id,
      userId: data.userId,
      contractId: data.contractId,
      creditTier: data.creditTier,
      creditScore: data.creditScore,
      totalPoints: data.totalPoints,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      // Including all required fields with null values for non-admin users
      annualIncome: null,
      annualIncomePoints: null,
      employmentHistoryMonths: null,
      employmentHistoryPoints: null,
      creditScorePoints: null,
      dtiRatio: null,
      dtiRatioPoints: null,
      housingStatus: null,
      housingPaymentHistory: null,
      housingStatusPoints: null,
      delinquencyHistory: null,
      delinquencyPoints: null,
      rawPreFiData: null,
      rawPlaidData: null
    }));

    // Return the data
    res.json({
      success: true,
      data: filteredData,
      count: filteredData.length
    });
  } catch (error: any) {
    console.error('Error fetching underwriting data:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: error.message
    });
  }
});

export default router;