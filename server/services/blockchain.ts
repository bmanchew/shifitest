import { ethers } from 'ethers';
import { Contract } from '../../shared/schema';
import { logger } from './logger';

interface BlockchainConfig {
  rpcUrl: string;
  contractAddress: string;
  privateKey: string;
  networkId: number;
}

interface TokenizationResult {
  success: boolean;
  tokenId?: string;
  transactionHash?: string;
  blockNumber?: number;
  smartContractAddress?: string;
  error?: string;
}

/**
 * Service to handle integration with blockchain for contract tokenization
 * and smart contract management
 */
export class BlockchainService {
  private provider: ethers.JsonRpcProvider | null = null;
  private wallet: ethers.Wallet | null = null;
  private contractInstance: ethers.Contract | null = null;
  private initialized = false;
  private config: BlockchainConfig | null = null;
  
  constructor() {
    this.initialize();
  }

  /**
   * Initialize the blockchain service with credentials from environment variables
   */
  private initialize() {
    const rpcUrl = process.env.BLOCKCHAIN_RPC_URL;
    const contractAddress = process.env.SMART_CONTRACT_ADDRESS;
    const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;
    const networkId = process.env.BLOCKCHAIN_NETWORK_ID ? 
      parseInt(process.env.BLOCKCHAIN_NETWORK_ID) : 1; // Default to Ethereum mainnet

    if (!rpcUrl || !contractAddress || !privateKey) {
      logger.warn({
        message: 'Blockchain service not initialized - missing configuration',
        category: 'system',
        source: 'blockchain'
      });
      return;
    }

    try {
      this.config = {
        rpcUrl,
        contractAddress,
        privateKey,
        networkId
      };

      // Initialize provider
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      
      // Initialize wallet
      this.wallet = new ethers.Wallet(privateKey, this.provider);
      
      // ABI will need to be defined based on your smart contract
      const abi = JSON.parse(process.env.SMART_CONTRACT_ABI || '[]');
      
      // Initialize contract instance
      this.contractInstance = new ethers.Contract(contractAddress, abi, this.wallet);
      
      this.initialized = true;
      
      logger.info({
        message: 'Blockchain service initialized',
        category: 'system',
        source: 'blockchain',
        metadata: {
          networkId: this.config.networkId,
          contractAddress: this.config.contractAddress
        }
      });
    } catch (error) {
      logger.error({
        message: `Error initializing blockchain service: ${error instanceof Error ? error.message : String(error)}`,
        category: 'system',
        source: 'blockchain',
        metadata: {
          error: error instanceof Error ? error.stack : null
        }
      });
    }
  }

  /**
   * Check if the service is properly initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Tokenize a ShiFi contract on the blockchain
   * @param contract The contract to tokenize
   * @returns Tokenization result with token ID and transaction details
   */
  async tokenizeContract(contract: Contract): Promise<TokenizationResult> {
    if (!this.isInitialized()) {
      logger.error({
        message: 'Cannot tokenize contract: Blockchain service not initialized',
        category: 'contract',
        source: 'blockchain',
        metadata: { contractId: contract.id }
      });
      return { 
        success: false, 
        error: 'Blockchain service not initialized' 
      };
    }

    try {
      // Create contract metadata for tokenization
      const contractMetadata = {
        contractNumber: contract.contractNumber,
        merchantId: contract.merchantId,
        customerId: contract.customerId,
        amount: contract.amount,
        downPayment: contract.downPayment,
        financedAmount: contract.financedAmount,
        termMonths: contract.termMonths,
        interestRate: contract.interestRate,
        monthlyPayment: contract.monthlyPayment,
        status: contract.status,
        createdAt: contract.createdAt
      };

      // Call smart contract to mint a new token representing this contract
      // The actual method name and parameters will depend on your smart contract implementation
      const tx = await this.contractInstance!.mintContractToken(
        contract.contractNumber,
        contract.merchantId,
        contract.customerId || 0,
        ethers.parseEther(contract.financedAmount.toString()), // Convert to wei
        contract.termMonths,
        Math.floor(contract.interestRate * 100), // Interest rate in basis points
        JSON.stringify(contractMetadata) // Store full metadata
      );

      // Wait for transaction to be mined
      const receipt = await tx.wait();
      
      // Extract token ID from transaction receipt (implementation depends on contract event structure)
      // This is a placeholder - you'll need to extract the actual token ID from your contract's events
      const tokenId = this.extractTokenIdFromReceipt(receipt);

      logger.info({
        message: `Contract ${contract.id} successfully tokenized on blockchain`,
        category: 'contract',
        source: 'blockchain',
        metadata: {
          contractId: contract.id,
          tokenId,
          transactionHash: receipt.hash,
          blockNumber: receipt.blockNumber
        }
      });

      return {
        success: true,
        tokenId,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        smartContractAddress: this.config!.contractAddress
      };
    } catch (error) {
      logger.error({
        message: `Error tokenizing contract on blockchain: ${error instanceof Error ? error.message : String(error)}`,
        category: 'contract',
        source: 'blockchain',
        metadata: {
          contractId: contract.id,
          error: error instanceof Error ? error.stack : null
        }
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Helper method to extract token ID from transaction receipt
   * This implementation will vary based on your smart contract's event structure
   */
  private extractTokenIdFromReceipt(receipt: any): string {
    // Placeholder implementation
    // In a real implementation, you would look for specific events in the receipt
    // and extract the token ID from those events
    
    // Example: receipt.logs.find(log => this.contractInstance!.interface.parseLog(log).name === 'TokenMinted').args.tokenId
    return `token-${Date.now()}-${Math.floor(Math.random() * 1000000)}`; // Temporary placeholder
  }

  /**
   * Get token details for a given token ID
   * @param tokenId The token ID to query
   * @returns The token details including contract data
   */
  async getTokenDetails(tokenId: string): Promise<any> {
    if (!this.isInitialized()) {
      throw new Error('Blockchain service not initialized');
    }

    try {
      // Call smart contract to get token details
      // The actual method name will depend on your smart contract implementation
      const tokenData = await this.contractInstance!.getTokenDetails(tokenId);
      
      return tokenData;
    } catch (error) {
      logger.error({
        message: `Error getting token details: ${error instanceof Error ? error.message : String(error)}`,
        category: 'api',
        source: 'blockchain',
        metadata: { tokenId }
      });
      throw error;
    }
  }

  /**
   * Update smart contract state when contract status changes
   * @param tokenId The token ID associated with the contract
   * @param newStatus The new status to update on the blockchain
   */
  async updateContractStatus(tokenId: string, newStatus: string): Promise<boolean> {
    if (!this.isInitialized()) {
      logger.error({
        message: 'Cannot update contract status: Blockchain service not initialized',
        category: 'contract',
        source: 'blockchain',
        metadata: { tokenId }
      });
      return false;
    }

    try {
      // Call smart contract to update status
      // The actual method name will depend on your smart contract implementation
      const tx = await this.contractInstance!.updateContractStatus(tokenId, newStatus);
      await tx.wait();
      
      logger.info({
        message: `Contract status updated on blockchain for token ${tokenId}`,
        category: 'contract',
        source: 'blockchain',
        metadata: { tokenId, newStatus }
      });
      
      return true;
    } catch (error) {
      logger.error({
        message: `Error updating contract status on blockchain: ${error instanceof Error ? error.message : String(error)}`,
        category: 'contract',
        source: 'blockchain',
        metadata: { 
          tokenId, 
          newStatus,
          error: error instanceof Error ? error.stack : null
        }
      });
      return false;
    }
  }

  /**
   * Record a payment transaction on the blockchain
   * @param tokenId The token ID associated with the contract
   * @param amount The payment amount
   * @param paymentDate The date of payment
   */
  async recordPayment(tokenId: string, amount: number, paymentDate: Date): Promise<boolean> {
    if (!this.isInitialized()) {
      logger.error({
        message: 'Cannot record payment: Blockchain service not initialized',
        category: 'payment',
        source: 'blockchain',
        metadata: { tokenId }
      });
      return false;
    }

    try {
      // Call smart contract to record payment
      // The actual method name will depend on your smart contract implementation
      const tx = await this.contractInstance!.recordPayment(
        tokenId, 
        ethers.parseEther(amount.toString()), 
        Math.floor(paymentDate.getTime() / 1000) // Convert to unix timestamp
      );
      await tx.wait();
      
      logger.info({
        message: `Payment recorded on blockchain for token ${tokenId}`,
        category: 'payment',
        source: 'blockchain',
        metadata: { tokenId, amount, paymentDate }
      });
      
      return true;
    } catch (error) {
      logger.error({
        message: `Error recording payment on blockchain: ${error instanceof Error ? error.message : String(error)}`,
        category: 'payment',
        source: 'blockchain',
        metadata: { 
          tokenId, 
          amount,
          error: error instanceof Error ? error.stack : null
        }
      });
      return false;
    }
  }

  /**
   * Validate blockchain service credentials
   * @returns Whether the credentials are valid
   */
  async validateCredentials(): Promise<boolean> {
    if (!this.isInitialized()) {
      return false;
    }

    try {
      // Simple check - try to get the network from the provider
      const network = await this.provider!.getNetwork();
      return network.chainId === BigInt(this.config!.networkId);
    } catch (error) {
      logger.error({
        message: `Error validating blockchain credentials: ${error instanceof Error ? error.message : String(error)}`,
        category: 'api',
        source: 'blockchain'
      });
      return false;
    }
  }
}

// Export a singleton instance
export const blockchainService = new BlockchainService();