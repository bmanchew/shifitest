import { Router, Request, Response } from 'express';
import { authenticateToken, isAdmin } from '../../middleware/auth';
import { blockchainService } from '../../services/blockchain';
import { storage } from '../../storage';
import { logger } from '../../services/logger';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * Check blockchain credentials and connection status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const isInitialized = blockchainService.isInitialized();
    const isValidCredentials = isInitialized ? await blockchainService.validateCredentials() : false;
    
    res.json({
      success: true,
      data: {
        initialized: isInitialized,
        credentialsValid: isValidCredentials
      }
    });
  } catch (error) {
    logger.error({
      message: `Error checking blockchain service status: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "blockchain",
      metadata: {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      }
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to check blockchain service status'
    });
  }
});

/**
 * Tokenize a contract on the blockchain
 * Requires admin privileges
 */
router.post('/tokenize/:contractId', isAdmin, async (req: Request, res: Response) => {
  try {
    const contractId = parseInt(req.params.contractId);
    
    if (isNaN(contractId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid contract ID'
      });
    }
    
    const contract = await storage.getContract(contractId);
    
    if (!contract) {
      return res.status(404).json({
        success: false,
        message: 'Contract not found'
      });
    }
    
    // Check if contract is already tokenized
    if (contract.tokenizationStatus === 'tokenized' && contract.tokenId) {
      return res.status(400).json({
        success: false,
        message: 'Contract is already tokenized',
        data: {
          tokenId: contract.tokenId,
          tokenizationStatus: contract.tokenizationStatus
        }
      });
    }
    
    // Attempt to tokenize the contract
    const result = await blockchainService.tokenizeContract(contract);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: 'Tokenization failed',
        error: result.error
      });
    }
    
    // Update contract with tokenization details
    await storage.updateContract(contractId, {
      tokenId: result.tokenId,
      tokenizationStatus: 'tokenized',
      tokenizationDate: new Date(),
      tokenizationError: null,
      smartContractAddress: result.smartContractAddress,
      blockchainTransactionHash: result.transactionHash
    });
    
    res.json({
      success: true,
      message: 'Contract tokenized successfully',
      data: {
        tokenId: result.tokenId,
        transactionHash: result.transactionHash,
        blockNumber: result.blockNumber,
        smartContractAddress: result.smartContractAddress
      }
    });
  } catch (error) {
    logger.error({
      message: `Error tokenizing contract: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "blockchain",
      metadata: {
        contractId: req.params.contractId,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      }
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to tokenize contract',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Get token details for a tokenized contract
 */
router.get('/token/:tokenId', async (req: Request, res: Response) => {
  try {
    const { tokenId } = req.params;
    
    if (!tokenId) {
      return res.status(400).json({
        success: false,
        message: 'Token ID is required'
      });
    }
    
    const tokenDetails = await blockchainService.getTokenDetails(tokenId);
    
    if (!tokenDetails) {
      return res.status(404).json({
        success: false,
        message: 'Token not found'
      });
    }
    
    res.json({
      success: true,
      data: tokenDetails
    });
  } catch (error) {
    logger.error({
      message: `Error fetching token details: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "blockchain",
      metadata: {
        tokenId: req.params.tokenId,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      }
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch token details',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Batch tokenize contracts with 'pendingTokenization' status
 * Requires admin privileges
 */
router.post('/tokenize-pending', isAdmin, async (req: Request, res: Response) => {
  try {
    // Get all contracts with pending tokenization status
    const pendingContracts = await storage.getContractsByTokenizationStatus('pendingTokenization');
    
    if (pendingContracts.length === 0) {
      return res.json({
        success: true,
        message: 'No contracts pending tokenization',
        data: {
          processed: 0,
          successful: 0,
          failed: 0
        }
      });
    }
    
    // Define type for token results
    interface TokenizationResultDetail {
      contractId: number;
      contractNumber: string;
      success: boolean;
      tokenId?: string;
      error?: string;
    }
    
    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      details: [] as TokenizationResultDetail[]
    };
    
    // Process each contract
    for (const contract of pendingContracts) {
      results.processed++;
      
      try {
        // Attempt to tokenize the contract
        const result = await blockchainService.tokenizeContract(contract);
        
        if (result.success) {
          // Update contract with tokenization details
          await storage.updateContract(contract.id, {
            tokenId: result.tokenId,
            tokenizationStatus: 'tokenized',
            tokenizationDate: new Date(),
            tokenizationError: null,
            smartContractAddress: result.smartContractAddress,
            blockchainTransactionHash: result.transactionHash
          });
          
          results.successful++;
          results.details.push({
            contractId: contract.id,
            contractNumber: contract.contractNumber,
            success: true,
            tokenId: result.tokenId
          });
        } else {
          // Update contract with error
          await storage.updateContract(contract.id, {
            tokenizationStatus: 'failed',
            tokenizationError: result.error
          });
          
          results.failed++;
          results.details.push({
            contractId: contract.id,
            contractNumber: contract.contractNumber,
            success: false,
            error: result.error
          });
        }
      } catch (error) {
        // Update contract with error
        await storage.updateContract(contract.id, {
          tokenizationStatus: 'failed',
          tokenizationError: error instanceof Error ? error.message : String(error)
        });
        
        results.failed++;
        results.details.push({
          contractId: contract.id,
          contractNumber: contract.contractNumber,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    res.json({
      success: true,
      message: 'Batch tokenization process completed',
      data: results
    });
  } catch (error) {
    logger.error({
      message: `Error in batch tokenization: ${error instanceof Error ? error.message : String(error)}`,
      category: "api",
      source: "blockchain",
      metadata: {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      }
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to process batch tokenization',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;