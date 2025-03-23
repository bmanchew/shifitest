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
  workspaceId: string;
  contractId: string;
  signingLink: string;
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

    try {
      const response = await fetch(`${this.baseUrl}/workspaces/${this.defaultWorkspaceId}/contracts/${options.contractId}/sign`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          signature: options.signatureData,
          signerName: options.signerName,
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
}

export default new ThanksRogerService();