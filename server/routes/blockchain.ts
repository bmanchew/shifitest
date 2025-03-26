import { Router, Request, Response } from 'express';
import { storage } from '../storage';
import { blockchainService } from '../services/blockchain';
import { logger } from '../services/logger';
import { validateContractId } from '../utils/contractHelpers';
import { z } from 'zod';

const blockchainRouter = Router();

/**
 * GET /blockchain/status
 * Check the status of the blockchain service
 */
blockchainRouter.get('/status', async (req: Request, res: Response) => {
  try {
    const isInitialized = blockchainService.isInitialized();
    let valid = false;
    
    if (isInitialized) {
      valid = await blockchainService.validateCredentials();
    }
    
    return res.json({
      success: true,
      status: {
        initialized: isInitialized,
        credentialsValid: valid
      }
    });
  } catch (error) {
    logger.error({
      message: `Error checking blockchain status: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'blockchain',
      req
    });
    
    return res.status(500).json({
      success: false,
      error: 'Error checking blockchain status'
    });
  }
});

/**
 * POST /blockchain/tokenize/:contractId
 * Tokenize a contract on the blockchain
 */
blockchainRouter.post('/tokenize/:contractId', async (req: Request, res: Response) => {
  try {
    // Validate contract ID
    const contractId = validateContractId(req.params.contractId);
    if (!contractId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid contract ID'
      });
    }
    
    // Get contract
    const contract = await storage.getContract(contractId);
    if (!contract) {
      return res.status(404).json({
        success: false,
        error: 'Contract not found'
      });
    }
    
    // Check if contract is already tokenized
    if (contract.tokenizationStatus === 'tokenized') {
      return res.status(400).json({
        success: false,
        error: 'Contract is already tokenized',
        tokenId: contract.tokenId
      });
    }
    
    // Update tokenization status to processing
    await storage.updateContract(contractId, {
      tokenizationStatus: 'processing'
    });
    
    // Perform tokenization
    const tokenizationResult = await blockchainService.tokenizeContract(contract);
    
    if (!tokenizationResult.success) {
      // Update status to failed
      await storage.updateContract(contractId, {
        tokenizationStatus: 'failed'
      });
      
      return res.status(500).json({
        success: false,
        error: tokenizationResult.error || 'Tokenization failed'
      });
    }
    
    // Update contract with tokenization details
    const updatedContract = await storage.updateContract(contractId, {
      tokenizationStatus: 'tokenized',
      tokenId: tokenizationResult.tokenId,
      smartContractAddress: tokenizationResult.smartContractAddress,
      blockchainTransactionHash: tokenizationResult.transactionHash,
      blockNumber: tokenizationResult.blockNumber,
      tokenizationDate: new Date(),
      tokenMetadata: JSON.stringify({
        contractNumber: contract.contractNumber,
        amount: contract.amount,
        financedAmount: contract.financedAmount,
        termMonths: contract.termMonths
      })
    });
    
    return res.json({
      success: true,
      contract: updatedContract,
      tokenization: tokenizationResult
    });
  } catch (error) {
    logger.error({
      message: `Error tokenizing contract: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'blockchain',
      req
    });
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error during tokenization'
    });
  }
});

/**
 * GET /blockchain/token/:tokenId
 * Get details of a token
 */
blockchainRouter.get('/token/:tokenId', async (req: Request, res: Response) => {
  try {
    const { tokenId } = req.params;
    
    // Check if token ID is valid
    if (!tokenId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid token ID'
      });
    }
    
    // Get token details from blockchain
    const tokenDetails = await blockchainService.getTokenDetails(tokenId);
    
    return res.json({
      success: true,
      token: tokenDetails
    });
  } catch (error) {
    logger.error({
      message: `Error getting token details: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'blockchain',
      req
    });
    
    return res.status(500).json({
      success: false,
      error: 'Error getting token details'
    });
  }
});

/**
 * POST /blockchain/update-status/:tokenId
 * Update contract status on blockchain
 */
blockchainRouter.post('/update-status/:tokenId', async (req: Request, res: Response) => {
  try {
    const { tokenId } = req.params;
    
    // Validate request body
    const schema = z.object({
      status: z.string()
    });
    
    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body'
      });
    }
    
    const { status } = validation.data;
    
    // Update status on blockchain
    const result = await blockchainService.updateContractStatus(tokenId, status);
    
    if (!result) {
      return res.status(500).json({
        success: false,
        error: 'Failed to update contract status on blockchain'
      });
    }
    
    return res.json({
      success: true,
      message: 'Contract status updated on blockchain'
    });
  } catch (error) {
    logger.error({
      message: `Error updating contract status on blockchain: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'blockchain',
      req
    });
    
    return res.status(500).json({
      success: false,
      error: 'Error updating contract status'
    });
  }
});

/**
 * POST /blockchain/record-payment/:tokenId
 * Record a payment on the blockchain
 */
blockchainRouter.post('/record-payment/:tokenId', async (req: Request, res: Response) => {
  try {
    const { tokenId } = req.params;
    
    // Validate request body
    const schema = z.object({
      amount: z.number().positive(),
      paymentDate: z.string().optional()
    });
    
    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body'
      });
    }
    
    const { amount } = validation.data;
    const paymentDate = validation.data.paymentDate ? new Date(validation.data.paymentDate) : new Date();
    
    // Record payment on blockchain
    const result = await blockchainService.recordPayment(tokenId, amount, paymentDate);
    
    if (!result) {
      return res.status(500).json({
        success: false,
        error: 'Failed to record payment on blockchain'
      });
    }
    
    return res.json({
      success: true,
      message: 'Payment recorded on blockchain'
    });
  } catch (error) {
    logger.error({
      message: `Error recording payment on blockchain: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'blockchain',
      req
    });
    
    return res.status(500).json({
      success: false,
      error: 'Error recording payment'
    });
  }
});

/**
 * GET /blockchain/templates
 * Get all smart contract templates
 */
blockchainRouter.get('/templates', async (req: Request, res: Response) => {
  try {
    const templates = await storage.getSmartContractTemplates();
    
    return res.json({
      success: true,
      templates
    });
  } catch (error) {
    logger.error({
      message: `Error getting smart contract templates: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'blockchain',
      req
    });
    
    return res.status(500).json({
      success: false,
      error: 'Error getting smart contract templates'
    });
  }
});

/**
 * GET /blockchain/templates/:id
 * Get a specific smart contract template
 */
blockchainRouter.get('/templates/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid template ID'
      });
    }
    
    const template = await storage.getSmartContractTemplate(id);
    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }
    
    return res.json({
      success: true,
      template
    });
  } catch (error) {
    logger.error({
      message: `Error getting smart contract template: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'blockchain',
      req
    });
    
    return res.status(500).json({
      success: false,
      error: 'Error getting smart contract template'
    });
  }
});

/**
 * POST /blockchain/templates
 * Create a new smart contract template
 */
blockchainRouter.post('/templates', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const schema = z.object({
      name: z.string(),
      description: z.string().optional(),
      contractType: z.string(),
      version: z.string(),
      abiJson: z.string(),
      bytecode: z.string(),
      sourceCode: z.string().optional(),
      parameters: z.string().optional(),
      merchantId: z.number().optional(),
      isActive: z.boolean().optional()
    });
    
    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body'
      });
    }
    
    // Create template
    const template = await storage.createSmartContractTemplate({
      name: validation.data.name,
      description: validation.data.description,
      contractType: validation.data.contractType,
      version: validation.data.version,
      abiJson: validation.data.abiJson,
      bytecode: validation.data.bytecode,
      sourceCode: validation.data.sourceCode,
      parameters: validation.data.parameters,
      merchantId: validation.data.merchantId,
      isActive: validation.data.isActive ?? true
    });
    
    return res.status(201).json({
      success: true,
      template
    });
  } catch (error) {
    logger.error({
      message: `Error creating smart contract template: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'blockchain',
      req
    });
    
    return res.status(500).json({
      success: false,
      error: 'Error creating smart contract template'
    });
  }
});

/**
 * GET /blockchain/deployments
 * Get all smart contract deployments
 */
blockchainRouter.get('/deployments', async (req: Request, res: Response) => {
  try {
    const deployments = await storage.getSmartContractDeployments();
    
    return res.json({
      success: true,
      deployments
    });
  } catch (error) {
    logger.error({
      message: `Error getting smart contract deployments: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'blockchain',
      req
    });
    
    return res.status(500).json({
      success: false,
      error: 'Error getting smart contract deployments'
    });
  }
});

/**
 * POST /blockchain/deployments
 * Create a new smart contract deployment
 */
blockchainRouter.post('/deployments', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const schema = z.object({
      templateId: z.number(),
      networkName: z.string(),
      networkId: z.number(),
      contractAddress: z.string(),
      transactionHash: z.string(),
      deployedBy: z.string(),
      deploymentParameters: z.string().optional(),
      status: z.string().optional()
    });
    
    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body'
      });
    }
    
    // Create deployment
    const deployment = await storage.createSmartContractDeployment({
      templateId: validation.data.templateId,
      networkId: validation.data.networkId,
      contractAddress: validation.data.contractAddress,
      transactionHash: validation.data.transactionHash,
      deployedBy: parseInt(validation.data.deployedBy) || null,
      deploymentParams: validation.data.deploymentParameters,
      status: validation.data.status || 'active'
    });
    
    return res.status(201).json({
      success: true,
      deployment
    });
  } catch (error) {
    logger.error({
      message: `Error creating smart contract deployment: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'blockchain',
      req
    });
    
    return res.status(500).json({
      success: false,
      error: 'Error creating smart contract deployment'
    });
  }
});

/**
 * POST /blockchain/tokenize/:contractId
 * Tokenize a contract on the blockchain
 */
blockchainRouter.post('/tokenize/:contractId', async (req: Request, res: Response) => {
  try {
    const contractId = validateContractId(req.params.contractId);
    
    if (!contractId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid contract ID'
      });
    }
    
    // Check if blockchain service is initialized
    if (!blockchainService.isInitialized()) {
      return res.status(503).json({
        success: false,
        error: 'Blockchain service is not available'
      });
    }
    
    // Get the contract from database
    const contract = await storage.getContract(contractId);
    
    if (!contract) {
      return res.status(404).json({
        success: false,
        error: 'Contract not found'
      });
    }
    
    // Check if contract is already tokenized
    if (contract.tokenizationStatus === 'tokenized' && contract.tokenId) {
      return res.status(400).json({
        success: false,
        error: 'Contract is already tokenized',
        tokenId: contract.tokenId
      });
    }
    
    // Update contract status to indicate tokenization is in progress
    await storage.updateContract(contractId, {
      tokenizationStatus: 'processing'
    });
    
    // Tokenize the contract
    const tokenizationResult = await blockchainService.tokenizeContract(contract);
    
    if (!tokenizationResult.success) {
      // Update contract to indicate tokenization failed
      await storage.updateContract(contractId, {
        tokenizationStatus: 'failed',
        tokenizationError: tokenizationResult.error
      });
      
      return res.status(500).json({
        success: false,
        error: 'Failed to tokenize contract',
        details: tokenizationResult.error
      });
    }
    
    // Update contract with tokenization details
    await storage.updateContract(contractId, {
      tokenizationStatus: 'tokenized',
      tokenId: tokenizationResult.tokenId,
      smartContractAddress: tokenizationResult.smartContractAddress,
      blockchainTransactionHash: tokenizationResult.transactionHash,
      tokenMetadata: JSON.stringify({
        blockNumber: tokenizationResult.blockNumber,
        createdAt: new Date(),
        network: process.env.BLOCKCHAIN_NETWORK_ID || '1'
      })
    });
    
    logger.info({
      message: `Contract ${contractId} successfully tokenized`,
      category: 'contract',
      source: 'blockchain',
      metadata: {
        contractId,
        tokenId: tokenizationResult.tokenId,
        transactionHash: tokenizationResult.transactionHash,
        smartContractAddress: tokenizationResult.smartContractAddress
      }
    });
    
    return res.json({
      success: true,
      message: 'Contract successfully tokenized',
      tokenId: tokenizationResult.tokenId,
      transactionHash: tokenizationResult.transactionHash,
      blockNumber: tokenizationResult.blockNumber,
      smartContractAddress: tokenizationResult.smartContractAddress
    });
  } catch (error) {
    logger.error({
      message: `Error tokenizing contract: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'blockchain',
      req
    });
    
    return res.status(500).json({
      success: false,
      error: 'Error tokenizing contract'
    });
  }
});

/**
 * GET /blockchain/token/:tokenId
 * Get details of a tokenized contract
 */
blockchainRouter.get('/token/:tokenId', async (req: Request, res: Response) => {
  try {
    const { tokenId } = req.params;
    
    if (!tokenId) {
      return res.status(400).json({
        success: false,
        error: 'Token ID is required'
      });
    }
    
    // Check if blockchain service is initialized
    if (!blockchainService.isInitialized()) {
      return res.status(503).json({
        success: false,
        error: 'Blockchain service is not available'
      });
    }
    
    // Get token details from blockchain
    const tokenDetails = await blockchainService.getTokenDetails(tokenId);
    
    return res.json({
      success: true,
      tokenDetails
    });
  } catch (error) {
    logger.error({
      message: `Error getting token details: ${error instanceof Error ? error.message : String(error)}`,
      category: 'api',
      source: 'blockchain',
      req
    });
    
    return res.status(500).json({
      success: false,
      error: 'Error getting token details'
    });
  }
});

export default blockchainRouter;