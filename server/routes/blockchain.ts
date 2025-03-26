import express, { Request, Response } from 'express';
import { storage } from '../storage';
import { logger } from '../services/logger';
import { blockchainService } from '../services/blockchain';
import { validateContractId } from '../utils/contractHelpers';

const router = express.Router();

/**
 * @route GET /api/blockchain/status
 * @desc Check blockchain service status and configuration
 * @access Private - Admin only
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const isInitialized = blockchainService.isInitialized();
    
    // Check environment variables without exposing sensitive information
    const envStatus = {
      rpcUrl: process.env.BLOCKCHAIN_RPC_URL ? 'configured' : 'missing',
      contractAddress: process.env.BLOCKCHAIN_CONTRACT_ADDRESS ? 'configured' : 'missing',
      privateKey: process.env.BLOCKCHAIN_PRIVATE_KEY ? 'configured' : 'missing',
      networkId: process.env.BLOCKCHAIN_NETWORK_ID || 'missing'
    };
    
    // Get counts of templates and deployments
    const templates = await storage.getSmartContractTemplates();
    const deployments = await storage.getSmartContractDeployments();
    
    // Count tokenized contracts
    const tokenizedContracts = await storage.getContractsByTokenizationStatus('tokenized');
    const pendingContracts = await storage.getContractsByTokenizationStatus('pending');
    const processingContracts = await storage.getContractsByTokenizationStatus('processing');
    const failedContracts = await storage.getContractsByTokenizationStatus('failed');
    
    res.json({
      success: true,
      status: {
        serviceInitialized: isInitialized,
        environment: envStatus,
        statistics: {
          templates: templates.length,
          deployments: deployments.length,
          tokenizedContracts: tokenizedContracts.length,
          pendingContracts: pendingContracts.length,
          processingContracts: processingContracts.length,
          failedContracts: failedContracts.length
        }
      }
    });
  } catch (error) {
    logger.error({
      message: `Failed to get blockchain status: ${error instanceof Error ? error.message : String(error)}`,
      category: 'system',
      source: 'blockchain',
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to get blockchain service status'
    });
  }
});

/**
 * @route GET /api/blockchain/secrets-status
 * @desc Check if required blockchain secrets (environment variables) are configured
 * @access Private - Admin only
 */
router.get('/secrets-status', async (req: Request, res: Response) => {
  try {
    // Check which environment variables are missing
    const requiredSecrets = [
      'BLOCKCHAIN_RPC_URL',
      'BLOCKCHAIN_CONTRACT_ADDRESS',
      'BLOCKCHAIN_PRIVATE_KEY',
      'BLOCKCHAIN_NETWORK_ID'
    ];
    
    const missingSecrets = requiredSecrets.filter(secret => !process.env[secret]);
    const allConfigured = missingSecrets.length === 0;
    
    res.json({
      success: true,
      configured: allConfigured,
      missing: missingSecrets
    });
  } catch (error) {
    logger.error({
      message: `Failed to check blockchain secrets status: ${error instanceof Error ? error.message : String(error)}`,
      category: 'system',
      source: 'blockchain',
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to check blockchain secrets status'
    });
  }
});

/**
 * @route GET /api/blockchain/templates
 * @desc Get all smart contract templates
 * @access Private - Admin only
 */
router.get('/templates', async (req: Request, res: Response) => {
  try {
    const templates = await storage.getSmartContractTemplates();
    
    res.json({
      success: true,
      templates
    });
  } catch (error) {
    logger.error({
      message: `Failed to get smart contract templates: ${error instanceof Error ? error.message : String(error)}`,
      category: 'system',
      source: 'blockchain',
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to get smart contract templates'
    });
  }
});

/**
 * @route GET /api/blockchain/templates/:id
 * @desc Get a specific smart contract template
 * @access Private - Admin only
 */
router.get('/templates/:id', async (req: Request, res: Response) => {
  try {
    const templateId = parseInt(req.params.id);
    
    if (isNaN(templateId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid template ID'
      });
    }
    
    const template = await storage.getSmartContractTemplate(templateId);
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Smart contract template not found'
      });
    }
    
    res.json({
      success: true,
      template
    });
  } catch (error) {
    logger.error({
      message: `Failed to get smart contract template: ${error instanceof Error ? error.message : String(error)}`,
      category: 'system',
      source: 'blockchain',
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        templateId: req.params.id
      }
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to get smart contract template'
    });
  }
});

/**
 * @route POST /api/blockchain/templates
 * @desc Create a new smart contract template
 * @access Private - Admin only
 */
router.post('/templates', async (req: Request, res: Response) => {
  try {
    const { name, description, contractType, abiJson, bytecode, sourceCode, version, merchantId, parameters } = req.body;
    
    if (!name || !contractType || !abiJson || !bytecode || !version) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }
    
    const template = await storage.createSmartContractTemplate({
      name,
      description,
      contractType,
      abiJson,
      bytecode,
      sourceCode,
      version,
      merchantId,
      parameters,
      isActive: true
    });
    
    logger.info({
      message: `Created new smart contract template: ${name}`,
      category: 'system',
      source: 'blockchain',
      metadata: {
        templateId: template.id,
        templateName: name,
        contractType
      }
    });
    
    res.status(201).json({
      success: true,
      template
    });
  } catch (error) {
    logger.error({
      message: `Failed to create smart contract template: ${error instanceof Error ? error.message : String(error)}`,
      category: 'system',
      source: 'blockchain',
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        requestBody: req.body
      }
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to create smart contract template'
    });
  }
});

/**
 * @route GET /api/blockchain/deployments
 * @desc Get all smart contract deployments
 * @access Private - Admin only
 */
router.get('/deployments', async (req: Request, res: Response) => {
  try {
    const deployments = await storage.getSmartContractDeployments();
    
    res.json({
      success: true,
      deployments
    });
  } catch (error) {
    logger.error({
      message: `Failed to get smart contract deployments: ${error instanceof Error ? error.message : String(error)}`,
      category: 'system',
      source: 'blockchain',
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to get smart contract deployments'
    });
  }
});

/**
 * @route GET /api/blockchain/contracts/:id/status
 * @desc Get tokenization status for a specific contract
 * @access Private - Admin only
 */
router.get('/contracts/:id/status', async (req: Request, res: Response) => {
  try {
    const contractId = validateContractId(req.params.id);
    
    if (!contractId) {
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
    
    // Extract only the tokenization-related info
    const tokenizationStatus = {
      contractId: contract.id,
      contractNumber: contract.contractNumber,
      tokenizationStatus: contract.tokenizationStatus,
      tokenId: contract.tokenId,
      smartContractAddress: contract.smartContractAddress,
      blockchainTransactionHash: contract.blockchainTransactionHash,
      blockNumber: contract.blockNumber,
      tokenizationDate: contract.tokenizationDate,
      purchasedByShifi: contract.purchasedByShifi,
      tokenizationError: contract.tokenizationError
    };
    
    res.json({
      success: true,
      tokenizationStatus
    });
  } catch (error) {
    logger.error({
      message: `Failed to get contract tokenization status: ${error instanceof Error ? error.message : String(error)}`,
      category: 'system',
      source: 'blockchain',
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        contractId: req.params.id
      }
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to get contract tokenization status'
    });
  }
});

/**
 * @route POST /api/blockchain/contracts/:id/tokenize
 * @desc Manually tokenize a specific contract
 * @access Private - Admin only
 */
router.post('/contracts/:id/tokenize', async (req: Request, res: Response) => {
  try {
    const contractId = validateContractId(req.params.id);
    
    if (!contractId) {
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
    
    // Check if already tokenized
    if (contract.tokenizationStatus === 'tokenized') {
      return res.status(400).json({
        success: false,
        message: 'Contract is already tokenized',
        tokenId: contract.tokenId
      });
    }
    
    // Check if blockchain service is initialized
    if (!blockchainService.isInitialized()) {
      return res.status(503).json({
        success: false,
        message: 'Blockchain service is not initialized. Check environment variables.'
      });
    }
    
    // Update contract status to processing
    await storage.updateContract(contractId, {
      tokenizationStatus: 'processing',
      tokenizationError: null
    });
    
    // Tokenize contract on blockchain
    const result = await blockchainService.tokenizeContract(contract);
    
    if (!result.success) {
      // Update contract with error
      await storage.updateContract(contractId, {
        tokenizationStatus: 'failed',
        tokenizationError: result.error
      });
      
      return res.status(500).json({
        success: false,
        message: 'Failed to tokenize contract on blockchain',
        error: result.error
      });
    }
    
    // Update contract with tokenization result
    await storage.updateContract(contractId, {
      tokenizationStatus: 'tokenized',
      tokenId: result.tokenId,
      smartContractAddress: result.smartContractAddress,
      blockchainTransactionHash: result.transactionHash,
      blockNumber: result.blockNumber,
      tokenizationDate: new Date()
    });
    
    logger.info({
      message: `Successfully tokenized contract #${contractId}`,
      category: 'contract',
      source: 'blockchain',
      metadata: {
        contractId,
        contractNumber: contract.contractNumber,
        tokenId: result.tokenId,
        transactionHash: result.transactionHash
      }
    });
    
    res.json({
      success: true,
      message: 'Contract successfully tokenized',
      tokenizationResult: {
        contractId,
        contractNumber: contract.contractNumber,
        tokenId: result.tokenId,
        smartContractAddress: result.smartContractAddress,
        transactionHash: result.transactionHash,
        blockNumber: result.blockNumber
      }
    });
  } catch (error) {
    logger.error({
      message: `Failed to tokenize contract: ${error instanceof Error ? error.message : String(error)}`,
      category: 'contract',
      source: 'blockchain',
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        contractId: req.params.id
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
 * @route POST /api/blockchain/contracts/:id/purchase-by-shifi
 * @desc Mark a contract as purchased by ShiFi and trigger tokenization
 * @access Private - Admin only
 */
router.post('/contracts/:id/purchase-by-shifi', async (req: Request, res: Response) => {
  try {
    const contractId = validateContractId(req.params.id);
    
    if (!contractId) {
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
    
    // Check if already purchased by ShiFi
    if (contract.purchasedByShifi) {
      return res.status(400).json({
        success: false,
        message: 'Contract is already marked as purchased by ShiFi'
      });
    }
    
    // Update contract to mark as purchased by ShiFi
    await storage.updateContract(contractId, {
      purchasedByShifi: true,
      tokenizationStatus: 'processing'
    });
    
    logger.info({
      message: `Contract #${contractId} marked as purchased by ShiFi`,
      category: 'contract',
      source: 'blockchain',
      metadata: {
        contractId,
        contractNumber: contract.contractNumber
      }
    });
    
    // Check if blockchain service is initialized
    let tokenizationResult = null;
    
    if (blockchainService.isInitialized()) {
      try {
        // Tokenize contract on blockchain
        const updatedContract = await storage.getContract(contractId);
        if (updatedContract) {
          const result = await blockchainService.tokenizeContract(updatedContract);
          
          if (result.success) {
            // Update contract with tokenization result
            await storage.updateContract(contractId, {
              tokenizationStatus: 'tokenized',
              tokenId: result.tokenId,
              smartContractAddress: result.smartContractAddress,
              blockchainTransactionHash: result.transactionHash,
              blockNumber: result.blockNumber,
              tokenizationDate: new Date()
            });
            
            tokenizationResult = {
              success: true,
              tokenId: result.tokenId,
              smartContractAddress: result.smartContractAddress,
              transactionHash: result.transactionHash,
              blockNumber: result.blockNumber
            };
            
            logger.info({
              message: `Successfully tokenized contract #${contractId} after ShiFi purchase`,
              category: 'contract',
              source: 'blockchain',
              metadata: {
                contractId,
                contractNumber: contract.contractNumber,
                tokenId: result.tokenId,
                transactionHash: result.transactionHash
              }
            });
          } else {
            // Update contract with error
            await storage.updateContract(contractId, {
              tokenizationStatus: 'failed',
              tokenizationError: result.error
            });
            
            tokenizationResult = {
              success: false,
              error: result.error
            };
            
            logger.error({
              message: `Failed to tokenize contract #${contractId} after ShiFi purchase`,
              category: 'contract',
              source: 'blockchain',
              metadata: {
                contractId,
                contractNumber: contract.contractNumber,
                error: result.error
              }
            });
          }
        }
      } catch (tokenizationError) {
        logger.error({
          message: `Error during tokenization after ShiFi purchase: ${tokenizationError instanceof Error ? tokenizationError.message : String(tokenizationError)}`,
          category: 'contract',
          source: 'blockchain',
          metadata: {
            contractId,
            contractNumber: contract.contractNumber,
            error: tokenizationError instanceof Error ? tokenizationError.message : String(tokenizationError)
          }
        });
        
        // Update contract with error
        await storage.updateContract(contractId, {
          tokenizationStatus: 'failed',
          tokenizationError: tokenizationError instanceof Error ? tokenizationError.message : String(tokenizationError)
        });
        
        tokenizationResult = {
          success: false,
          error: tokenizationError instanceof Error ? tokenizationError.message : String(tokenizationError)
        };
      }
    } else {
      logger.warn({
        message: `Contract #${contractId} marked as purchased by ShiFi but blockchain service not initialized`,
        category: 'contract',
        source: 'blockchain',
        metadata: {
          contractId,
          contractNumber: contract.contractNumber
        }
      });
    }
    
    res.json({
      success: true,
      message: 'Contract successfully marked as purchased by ShiFi',
      contractId,
      contractNumber: contract.contractNumber,
      purchasedByShifi: true,
      tokenizationResult
    });
  } catch (error) {
    logger.error({
      message: `Failed to mark contract as purchased by ShiFi: ${error instanceof Error ? error.message : String(error)}`,
      category: 'contract',
      source: 'blockchain',
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        contractId: req.params.id
      }
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to mark contract as purchased by ShiFi',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * @route GET /api/blockchain/contracts/tokenized
 * @desc Get all tokenized contracts
 * @access Private - Admin only
 */
/**
 * @route GET /api/blockchain/contracts/:status
 * @desc Get contracts with a specific tokenization status
 * @access Private - Admin only
 */
router.get('/contracts/:status', async (req: Request, res: Response) => {
  try {
    const { status } = req.params;
    
    // Validate the status parameter
    const validStatuses = ['pending', 'processing', 'tokenized', 'failed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tokenization status. Must be one of: pending, processing, tokenized, failed'
      });
    }
    
    const contracts = await storage.getContractsByTokenizationStatus(status);
    
    // Return the contracts array directly without wrapping it in a data object
    // This ensures compatibility with the frontend component's data.map() call
    res.json(contracts);
  } catch (error) {
    logger.error({
      message: `Failed to get contracts with status ${req.params.status}: ${error instanceof Error ? error.message : String(error)}`,
      category: 'system',
      source: 'blockchain',
      metadata: {
        status: req.params.status,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    
    // Return an empty array instead of an error response
    // This ensures compatibility with the frontend component's data.map() call
    res.json([]);
  }
});

/**
 * @route GET /api/blockchain/contracts/tokenized
 * @desc Get all tokenized contracts
 * @access Private - Admin only
 */
router.get('/contracts/tokenized', async (req: Request, res: Response) => {
  try {
    const tokenizedContracts = await storage.getContractsByTokenizationStatus('tokenized');
    
    res.json({
      success: true,
      count: tokenizedContracts.length,
      contracts: tokenizedContracts
    });
  } catch (error) {
    logger.error({
      message: `Failed to get tokenized contracts: ${error instanceof Error ? error.message : String(error)}`,
      category: 'system',
      source: 'blockchain',
      metadata: {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }
    });
    
    res.status(500).json({
      success: false,
      message: 'Failed to get tokenized contracts'
    });
  }
});

export default router;