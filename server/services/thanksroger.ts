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
    sendEmail?: boolean;
  }) {
    if (!this.initialized) {
      logger.warn({
        message: 'Thanks Roger service not initialized',
        category: 'contract',
        source: 'thanksroger'
      });
      return null;
    }

    try {
      const response = await fetch(`${this.baseUrl}/workspaces/${this.defaultWorkspaceId}/contracts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          templateId: process.env.THANKSROGER_TEMPLATE_ID,
          templateValues: {
            'Customer Name': { type: 'singletext', value: options.customerName },
            'Customer Email': { type: 'singletext', value: options.customerEmail },
            'Merchant Name': { type: 'singletext', value: options.merchantName },
            'Contract Number': { type: 'singletext', value: options.contractNumber },
            'Amount': { type: 'singletext', value: options.amount.toString() },
            'Down Payment': { type: 'singletext', value: options.downPayment.toString() },
            'Financed Amount': { type: 'singletext', value: options.financedAmount.toString() },
            'Term Months': { type: 'singletext', value: options.termMonths.toString() },
            'Interest Rate': { type: 'singletext', value: options.interestRate.toString() },
            'Monthly Payment': { type: 'singletext', value: options.monthlyPayment.toString() }
          },
          createdBy: 'system@shifi.com',
          name: `Financing Agreement - ${options.contractNumber}`,
          email: options.sendEmail || false
        })
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

    const workspaceId = options.workspaceId || this.defaultWorkspaceId;
    if (!workspaceId) {
      logger.error({
        message: 'Cannot create contract: No workspace ID provided',
        category: 'api',
        source: 'thanksroger'
      });
      return null;
    }

    try {
      const url = `${this.baseUrl}/workspaces/${workspaceId}/contracts`;
      
      const requestBody = {
        templateId: options.templateId,
        templateValues: options.templateValues,
        createdBy: options.createdBy,
        name: options.name,
        email: options.email || false // Default to false to avoid sending emails
      };
      
      if (this.debugMode) {
        logger.info({
          message: 'ThanksRoger API request',
          category: 'api',
          source: 'thanksroger',
          metadata: {
            url,
            method: 'POST',
            requestBody,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey ? this.apiKey.substring(0, 5) + '...' : 'undefined'}`
            }
          }
        });
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        if (response.status === 401) {
          logger.error({
            message: 'Authentication failed with Thanks Roger API: Invalid API key or insufficient permissions',
            category: 'api',
            source: 'thanksroger',
            metadata: {
              statusCode: response.status,
              responseText: errorText,
              workspaceId
            }
          });
          throw new Error('Authentication failed: Invalid API key or insufficient permissions');
        } else if (response.status === 404) {
          logger.error({
            message: 'Resource not found in Thanks Roger API: Invalid workspaceId or templateId',
            category: 'api',
            source: 'thanksroger',
            metadata: {
              statusCode: response.status,
              responseText: errorText,
              workspaceId,
              templateId: options.templateId
            }
          });
          throw new Error('Resource not found: Invalid workspace ID or template ID');
        }
        
        throw new Error(`Failed to create contract: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      logger.info({
        message: 'Contract created successfully',
        category: 'api',
        source: 'thanksroger',
        metadata: {
          contractId: data.contractId,
          workspaceId: data.workspaceId
        }
      });
      
      return data;
    } catch (error) {
      logger.error({
        message: `Failed to create contract: ${error instanceof Error ? error.message : String(error)}`,
        category: 'api',
        source: 'thanksroger',
        metadata: { 
          templateId: options.templateId,
          error: error instanceof Error ? error.stack : null
        }
      });
      return null;
    }
  }

  /**
   * Sign a contract with signature data
   */
  async signContract(options: ThanksRogerSignContractOptions): Promise<ThanksRogerSignContractResponse | null> {
    if (!this.isInitialized()) {
      logger.error({
        message: 'Cannot sign contract: Thanks Roger service not initialized',
        category: 'api',
        source: 'thanksroger'
      });
      return null;
    }

    try {
      // Call the Thanks Roger API to apply the signature
      const url = `${this.baseUrl}/workspaces/${this.defaultWorkspaceId}/contracts/${options.contractId}/signatures`;
      
      logger.info({
        message: `Attempting to sign contract ${options.contractId}`,
        category: 'api',
        source: 'thanksroger',
        metadata: {
          contractId: options.contractId,
          signerName: options.signerName
        }
      });
      
      const requestBody = {
        signatureData: options.signatureData,
        signerName: options.signerName,
        signatureDate: options.signatureDate || new Date().toISOString()
      };
      
      if (this.debugMode) {
        logger.info({
          message: 'ThanksRoger API signing request',
          category: 'api',
          source: 'thanksroger',
          metadata: {
            url,
            method: 'POST',
            requestBody: {
              ...requestBody,
              signatureData: options.signatureData.substring(0, 30) + '...' // Truncate for logging
            },
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey ? this.apiKey.substring(0, 5) + '...' : 'undefined'}`
            }
          }
        });
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        if (response.status === 401) {
          logger.error({
            message: 'Authentication failed with Thanks Roger API: Invalid API key or insufficient permissions',
            category: 'api',
            source: 'thanksroger',
            metadata: {
              statusCode: response.status,
              responseText: errorText
            }
          });
          throw new Error('Authentication failed: Invalid API key or insufficient permissions');
        }
        
        throw new Error(`Failed to sign contract: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      logger.info({
        message: 'Contract signed successfully',
        category: 'api',
        source: 'thanksroger',
        metadata: {
          contractId: options.contractId,
          signatureId: data.signatureId
        }
      });
      
      return {
        success: true,
        contractId: options.contractId,
        signatureId: data.signatureId,
        status: data.status,
        signedAt: data.signedAt,
        documentUrl: data.documentUrl
      };
    } catch (error) {
      logger.error({
        message: `Failed to sign contract: ${error instanceof Error ? error.message : String(error)}`,
        category: 'api',
        source: 'thanksroger',
        metadata: { 
          contractId: options.contractId,
          error: error instanceof Error ? error.stack : null
        }
      });
      return null;
    }
  }

  /**
   * Verify that the API key is valid by making a test request
   */
  async validateCredentials(): Promise<boolean> {
    if (!this.isInitialized()) {
      return false;
    }
    
    if (!this.defaultWorkspaceId) {
      logger.error({
        message: 'Cannot validate credentials: No workspace ID configured',
        category: 'api',
        source: 'thanksroger'
      });
      return false;
    }

    try {
      // We'll use a simple GET request to check if our API key is valid
      const workspaceId = this.defaultWorkspaceId;
      const url = `${this.baseUrl}/workspaces/${workspaceId}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (response.status === 401) {
        logger.error({
          message: 'API key validation failed: Invalid API key or insufficient permissions',
          category: 'api',
          source: 'thanksroger'
        });
        return false;
      }
      
      if (response.status === 404) {
        logger.error({
          message: 'API key validation failed: Workspace not found',
          category: 'api',
          source: 'thanksroger',
          metadata: { workspaceId }
        });
        return false;
      }

      return response.ok;
    } catch (error) {
      logger.error({
        message: `API key validation failed: ${error instanceof Error ? error.message : String(error)}`,
        category: 'api',
        source: 'thanksroger'
      });
      return false;
    }
  }

  /**
   * Create a financing contract from a template
   * 
   * This is a specialized version of createContract with pre-filled template values
   * specific to our financing contracts
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
    sendEmail?: boolean;
    opportunityId?: string;
  }): Promise<ThanksRogerCreateContractResponse | null> {
    const {
      templateId,
      customerName,
      customerEmail,
      merchantName,
      contractNumber,
      amount,
      downPayment,
      financedAmount,
      termMonths,
      interestRate,
      monthlyPayment,
      sendEmail = false,
      opportunityId
    } = options;

    // Format currency values
    const formatCurrency = (value: number) => 
      value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    
    const formattedAmount = formatCurrency(amount);
    const formattedDownPayment = formatCurrency(downPayment);
    const formattedFinancedAmount = formatCurrency(financedAmount);
    const formattedMonthlyPayment = formatCurrency(monthlyPayment);
    
    // Create payment schedule for installments
    const paymentSchedule = Array.from({ length: termMonths }, (_, i) => {
      const paymentNumber = i + 1;
      const paymentDate = new Date();
      paymentDate.setMonth(paymentDate.getMonth() + paymentNumber);
      
      return `Payment #${paymentNumber}: ${formattedMonthlyPayment} due on ${paymentDate.toLocaleDateString()}`;
    }).join('\n');

    const contractName = `Financing Agreement - ${customerName} - ${contractNumber}`;
    
    // Prepare the email configuration if sending is enabled
    const emailConfig = sendEmail ? {
      subject: `Financing Agreement Ready for Signature - ${contractNumber}`,
      message: `Dear ${customerName},\n\nYour financing agreement with ${merchantName} is ready for your review and signature. Please click the link below to review and sign the agreement.\n\nThank you for your business.`
    } : false;

    // Create template values as required by Thanks Roger API
    const templateValues: Record<string, TemplateValueObject> = {
      "Customer Name": {
        type: "singletext",
        value: customerName
      },
      "Customer Email": {
        type: "singletext",
        value: customerEmail
      },
      "Merchant Name": {
        type: "singletext",
        value: merchantName
      },
      "Contract Number": {
        type: "singletext",
        value: contractNumber
      },
      "Total Amount": {
        type: "singletext",
        value: formattedAmount
      },
      "Down Payment": {
        type: "singletext",
        value: formattedDownPayment
      },
      "Financed Amount": {
        type: "singletext",
        value: formattedFinancedAmount
      },
      "Term (Months)": {
        type: "singletext",
        value: termMonths.toString()
      },
      "Interest Rate": {
        type: "singletext",
        value: `${interestRate}%`
      },
      "Monthly Payment": {
        type: "singletext",
        value: formattedMonthlyPayment
      },
      "Payment Schedule": {
        type: "multitext",
        value: paymentSchedule
      },
      "Terms and Conditions": {
        type: "richtext",
        value: `<h3>Financing Terms and Conditions</h3>
<p>This financing agreement is between the Customer and ${merchantName}.</p>
<ol>
  <li>The Customer agrees to pay the Down Payment amount at the time of signing.</li>
  <li>The remaining Financed Amount will be paid in ${termMonths} equal monthly installments.</li>
  <li>Each monthly payment of ${formattedMonthlyPayment} is due on the same day of each month following the contract signing date.</li>
  <li>The interest rate for this agreement is fixed at ${interestRate}% for the entire term.</li>
  <li>Early payment of the remaining balance is permitted without penalty.</li>
  <li>Late payments may incur a fee of 5% of the monthly payment amount.</li>
</ol>`
      }
    };

    // Add opportunity ID if provided (for webhook tracking)
    if (opportunityId) {
      templateValues["Opportunity ID"] = {
        type: "singletext",
        value: opportunityId
      };
    }

    return this.createContract({
      templateId,
      templateValues,
      createdBy: "financing@shifi.com",
      name: contractName,
      email: emailConfig
    });
  }
}

export const thanksRogerService = new ThanksRogerService();