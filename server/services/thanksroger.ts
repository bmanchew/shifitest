import { logger } from './logger';

interface ThanksRogerCreateContractOptions {
  templateId: string;
  templateValues: Record<string, TemplateValueObject>;
  createdBy: string;
  name: string;
  email?: boolean | {
    logoUrl?: string | null;
    subject?: string;
    message?: string;
  };
  workspaceId?: string;
}

interface TemplateValueObject {
  type: 'singletext' | 'multitext' | 'richtext';
  value: string;
}

interface ThanksRogerCreateContractResponse {
  workspaceId?: string;
  contractId: string;
  signingLink: string;
  status?: string;
}

interface ThanksRogerSignContractOptions {
  contractId: string;
  signatureData: string;
  signerName: string;
  signatureDate?: string;
}

interface ThanksRogerSignContractResponse {
  success: boolean;
  contractId: string;
  signatureId: string;
  status: string;
  signedAt: string;
  documentUrl?: string;
}

class ThanksRogerService {
  private apiKey: string | undefined;
  private defaultWorkspaceId: string | undefined;
  private initialized = false;
  private baseUrl = 'https://app.thanksroger.com/api/v3';

  // For debugging purposes, log raw API responses
  private debugMode: boolean = process.env.DEBUG_API === 'true';

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the service with credentials from environment variables
   */
  private initialize() {
    this.apiKey = process.env.THANKSROGER_API_KEY;

    // Get workspace ID from environment variables
    this.defaultWorkspaceId = process.env.THANKSROGER_WORKSPACE_ID || 'wvEOhUlU8rHy5EXAwNn1';

    this.initialized = !!this.apiKey;

    if (this.initialized) {
      logger.info({
        message: 'Thanks Roger service initialized with API key',
        category: 'system',
        source: 'thanksroger'
      });
    } else {
      logger.warn({
        message: 'Thanks Roger service not initialized - THANKSROGER_API_KEY is not set',
        category: 'system',
        source: 'thanksroger'
      });
    }

    if (!this.defaultWorkspaceId) {
      logger.warn({
        message: 'Thanks Roger workspace ID is not set - THANKSROGER_WORKSPACE_ID is not set',
        category: 'system',
        source: 'thanksroger'
      });
    }
  }

  /**
   * Check if the service is properly initialized with credentials
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Create a contract from a template
   * 
   * @param options Contract creation options
   * @returns The created contract information including signing link
   */
  async createContract(options: ThanksRogerCreateContractOptions): Promise<ThanksRogerCreateContractResponse | null> {
    if (!this.isInitialized()) {
      logger.error({
        message: 'Cannot create contract: Thanks Roger service not initialized (missing API key)',
        category: 'api',
        source: 'thanksroger'
      });
      return null;
    }

    try {
      const workspaceId = options.workspaceId || this.defaultWorkspaceId;

      if (!workspaceId) {
        throw new Error('Workspace ID is required but not provided');
      }

      const payload = {
        templateId: options.templateId,
        templateValues: options.templateValues,
        createdBy: options.createdBy,
        name: options.name,
        email: options.email || false
      };

      if (this.debugMode) {
        logger.debug({
          message: 'Creating Thanks Roger contract with payload',
          category: 'api',
          source: 'thanksroger',
          metadata: { payload }
        });
      }

      const response = await fetch(`${this.baseUrl}/workspaces/${workspaceId}/contracts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Thanks Roger API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return {
        workspaceId: workspaceId,
        contractId: data.contractId,
        signingLink: data.signingLink,
        status: 'created'
      };
    } catch (error) {
      logger.error({
        message: `Error creating Thanks Roger contract: ${error instanceof Error ? error.message : String(error)}`,
        category: 'contract',
        source: 'thanksroger',
        metadata: { options }
      });
      return null;
    }
  }

  async signContract(options: {
    contractId: string;
    signatureData: string;
    signerName: string;
    signatureDate: string;
  }): Promise<ThanksRogerSignContractResponse> {
    if (!this.initialized) {
      throw new Error('Thanks Roger service not initialized');
    }

    // Ensure signerName is not empty or undefined
    const signerName = options.signerName && options.signerName.trim() ? 
                        options.signerName : 
                        "Customer";
                        
    logger.debug({
      message: `Signing contract with Thanks Roger`,
      category: 'contract',
      source: 'thanksroger',
      metadata: { 
        contractId: options.contractId,
        signerName 
      }
    });

    try {
      const response = await fetch(`${this.baseUrl}/workspaces/${this.defaultWorkspaceId}/contracts/${options.contractId}/sign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          signature: options.signatureData,
          signerName: signerName,
          signedAt: options.signatureDate
        })
      });

      if (!response.ok) {
        throw new Error(`Thanks Roger API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        contractId: options.contractId,
        signatureId: data.signatureId,
        status: 'signed',
        signedAt: options.signatureDate,
        documentUrl: data.documentUrl
      };
    } catch (error) {
      logger.error({
        message: `Error signing Thanks Roger contract: ${error instanceof Error ? error.message : String(error)}`,
        category: 'contract',
        source: 'thanksroger',
        metadata: { contractId: options.contractId }
      });
      throw error;
    }
  }

  async validateCredentials(): Promise<boolean> {
    if (!this.initialized) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/workspaces/${this.defaultWorkspaceId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // Use an arrow function to ensure proper 'this' binding
  getApiStatus = (): string => {
    return this.initialized ? 'initialized' : 'not initialized';
  }

  /**
   * Update the status of a contract in Thanks Roger
   */
  async updateContractStatus(options: {
    contractId: string;
    status: string;
    completedAt?: string;
  }): Promise<boolean> {
    if (!this.isInitialized()) {
      logger.warn({
        message: 'Cannot update contract status: Thanks Roger service not initialized',
        category: 'api',
        source: 'thanksroger',
        metadata: { contractId: options.contractId }
      });
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/workspaces/${this.defaultWorkspaceId}/contracts/${options.contractId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: options.status,
          completedAt: options.completedAt || new Date().toISOString()
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Thanks Roger API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      logger.info({
        message: `Successfully updated contract status in Thanks Roger: ${options.contractId} to ${options.status}`,
        category: 'contract',
        source: 'thanksroger',
        metadata: { contractId: options.contractId, status: options.status }
      });

      return true;
    } catch (error) {
      logger.error({
        message: `Error updating Thanks Roger contract status: ${error instanceof Error ? error.message : String(error)}`,
        category: 'contract',
        source: 'thanksroger',
        metadata: { 
          contractId: options.contractId,
          status: options.status,
          error: error instanceof Error ? error.stack : null
        }
      });
      return false;
    }
  }

  /**
   * Create a financing contract with Thanks Roger
   * This is a specialized wrapper around createContract that formats the template values for a financing contract
   */
  async createFinancingContract(options: {
    templateId: string;
    customerName: string;
    customerEmail: string;
    merchantName: string;
    contractNumber: string;
    amount: number;
    downPayment: number;
    financedAmount: number;
    termMonths: number;
    interestRate: number;
    monthlyPayment: number;
    sendEmail: boolean;
  }): Promise<ThanksRogerCreateContractResponse | null> {
    if (!this.isInitialized()) {
      logger.error({
        message: 'Cannot create financing contract: Thanks Roger service not initialized',
        category: 'api',
        source: 'thanksroger'
      });
      return null;
    }

    // Format financial values for the template
    const formattedAmount = options.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    const formattedDownPayment = options.downPayment.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    const formattedFinancedAmount = options.financedAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    const formattedMonthlyPayment = options.monthlyPayment.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    
    // Create template values for Thanks Roger
    const templateValues = {
      customer_name: { type: 'singletext', value: options.customerName },
      merchant_name: { type: 'singletext', value: options.merchantName },
      contract_number: { type: 'singletext', value: options.contractNumber },
      total_amount: { type: 'singletext', value: formattedAmount },
      down_payment: { type: 'singletext', value: formattedDownPayment },
      financed_amount: { type: 'singletext', value: formattedFinancedAmount },
      term_months: { type: 'singletext', value: options.termMonths.toString() },
      interest_rate: { type: 'singletext', value: options.interestRate.toString() + '%' },
      monthly_payment: { type: 'singletext', value: formattedMonthlyPayment },
      todays_date: { type: 'singletext', value: new Date().toLocaleDateString('en-US') }
    };

    // Create the contract using the general purpose contract creation method
    return this.createContract({
      templateId: options.templateId,
      templateValues: templateValues as Record<string, TemplateValueObject>,
      createdBy: 'ShiFi Financing',
      name: `Financing Contract #${options.contractNumber}`,
      email: options.sendEmail ? {
        subject: 'Your ShiFi Financing Contract',
        message: `Dear ${options.customerName},\n\nPlease find attached your financing contract #${options.contractNumber}.\n\nThank you for choosing ShiFi.`,
        logoUrl: 'https://app.shifi.com/logo.png'
      } : false
    });
  }
}

export const thanksRogerService = new ThanksRogerService();