/**
 * Thanks Roger service for contract generation and digital signing
 * 
 * This service integrates with the Thanks Roger API to:
 * - Create contracts from templates
 * - Generate signing links
 * - Handle email sending for contract signatures
 * - Process webhook events
 */

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

class ThanksRogerService {
  private apiKey: string | undefined;
  private defaultWorkspaceId: string | undefined;
  private initialized = false;
  private baseUrl = 'https://app.thanksroger.com/api/v3';

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the service with credentials from environment variables
   */
  private initialize() {
    this.apiKey = process.env.THANKSROGER_API_KEY;
    
    // Typically you'd want to store your workspace ID in environment variables or configuration
    // For this implementation, we'll use a default value if not provided
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
        message: 'Thanks Roger service initialized without API key',
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
        message: 'Cannot create contract: Thanks Roger service not initialized',
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
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          templateId: options.templateId,
          templateValues: options.templateValues,
          createdBy: options.createdBy,
          name: options.name,
          email: options.email
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create contract: ${response.status} ${response.statusText}`);
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
   * Verify that the API key is valid by making a test request
   */
  async validateCredentials(): Promise<boolean> {
    if (!this.isInitialized()) {
      return false;
    }

    try {
      // We'll use a simple GET request to check if our API key is valid
      // The actual endpoint may vary based on Thanks Roger's API
      const workspaceId = this.defaultWorkspaceId;
      const url = `${this.baseUrl}/workspaces/${workspaceId}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

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