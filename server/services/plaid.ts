import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  CountryCode,
  Products,
  LinkTokenCreateRequest,
  ProcessorTokenCreateRequest,
  TransferCreateRequest,
  TransferType,
  TransferNetwork,
  AssetReportCreateRequest,
} from "plaid";
import { logger } from "./logger";

interface PlaidLinkTokenParams {
  userId: string;
  clientUserId: string;
  userName?: string;
  userEmail?: string;
  products?: Products[];
  redirectUri?: string;
}

interface PlaidTransferParams {
  accessToken: string;
  accountId: string;
  amount: number;
  description: string;
  achClass?: string;
  userId?: string;
  customerId?: string;
  metadata?: Record<string, string>;
}

interface PlaidAssetReportParams {
  accessToken: string;
  daysRequested: number;
  clientReportId?: string;
  webhook?: string;
  user?: {
    clientUserId: string;
    firstName?: string;
    lastName?: string;
    ssn?: string;
    phoneNumber?: string;
    email?: string;
  };
}

class PlaidService {
  private client: PlaidApi | null = null;
  private initialized = false;
  private env: string;

  constructor() {
    this.env = process.env.PLAID_ENVIRONMENT || "sandbox";
    this.initialize();
  }

  private initialize() {
    const clientId = process.env.PLAID_CLIENT_ID;
    const secret = process.env.PLAID_SECRET;

    if (!clientId || !secret) {
      logger.warn({
        message:
          "Plaid credentials not configured, functionality will be limited",
        category: "system",
        source: "plaid",
      });
      return;
    }

    try {
      // Determine which Plaid environment to use
      let environment;
      switch (this.env.toLowerCase()) {
        case "production":
          environment = PlaidEnvironments.production;
          break;
        case "development":
          environment = PlaidEnvironments.development;
          break;
        case "sandbox":
        default:
          environment = PlaidEnvironments.sandbox;
          break;
      }

      const configuration = new Configuration({
        basePath: environment,
        baseOptions: {
          headers: {
            "PLAID-CLIENT-ID": clientId,
            "PLAID-SECRET": secret,
          },
        },
      });

      this.client = new PlaidApi(configuration);
      this.initialized = true;

      logger.info({
        message: `Plaid service initialized in ${this.env} environment`,
        category: "system",
        source: "plaid",
      });
    } catch (error) {
      logger.error({
        message: `Failed to initialize Plaid client: ${error instanceof Error ? error.message : String(error)}`,
        category: "system",
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.stack : null,
        },
      });
    }
  }

  isInitialized(): boolean {
    return this.initialized && this.client !== null;
  }

  /**
   * Create a link token for Plaid Link
   */
  async createLinkToken(params: PlaidLinkTokenParams) {
    if (!this.isInitialized() || !this.client) {
      throw new Error("Plaid client not initialized");
    }

    try {
      const {
        userId,
        clientUserId,
        userName,
        userEmail,
        products = [Products.Auth, Products.Transactions],
        redirectUri,
      } = params;

      // Prepare user object for the request
      const user = {
        client_user_id: clientUserId,
        legal_name: userName,
        email_address: userEmail,
      };

      // Prepare request
      const request: LinkTokenCreateRequest = {
        user,
        client_name: "ShiFi Financial",
        products: products,
        country_codes: [CountryCode.Us],
        language: "en",
        webhook: `${process.env.PUBLIC_URL || "https://api.shifi.com"}/api/plaid/webhook`,
      };

      // Add optional redirect URI if provided
      if (redirectUri) {
        request.redirect_uri = redirectUri;
      }

      logger.info({
        message: `Creating Plaid link token for user ${userId}`,
        category: "api",
        source: "plaid",
        metadata: { userId, products },
      });

      const response = await this.client.linkTokenCreate(request);

      logger.info({
        message: `Created Plaid link token for user ${userId}`,
        category: "api",
        source: "plaid",
        metadata: {
          userId,
          linkToken: response.data.link_token,
          expiration: response.data.expiration,
        },
      });

      return {
        linkToken: response.data.link_token,
        expiration: response.data.expiration,
      };
    } catch (error) {
      logger.error({
        message: `Failed to create Plaid link token: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: {
          userId: params.userId,
          error: error instanceof Error ? error.stack : null,
        },
      });

      throw error;
    }
  }

  /**
   * Exchange a public token for an access token
   */
  async exchangePublicToken(publicToken: string) {
    if (!this.isInitialized() || !this.client) {
      throw new Error("Plaid client not initialized");
    }

    try {
      logger.info({
        message: "Exchanging Plaid public token for access token",
        category: "api",
        source: "plaid",
      });

      const response = await this.client.itemPublicTokenExchange({
        public_token: publicToken,
      });

      logger.info({
        message: "Exchanged Plaid public token for access token",
        category: "api",
        source: "plaid",
        metadata: {
          itemId: response.data.item_id,
          requestId: response.data.request_id,
        },
      });

      return {
        accessToken: response.data.access_token,
        itemId: response.data.item_id,
      };
    } catch (error) {
      logger.error({
        message: `Failed to exchange Plaid public token: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.stack : null,
        },
      });

      throw error;
    }
  }

  /**
   * Get auth data (account and routing numbers)
   */
  async getAuth(accessToken: string) {
    if (!this.isInitialized() || !this.client) {
      throw new Error("Plaid client not initialized");
    }

    try {
      logger.info({
        message: "Getting Plaid auth data",
        category: "api",
        source: "plaid",
      });

      const response = await this.client.authGet({
        access_token: accessToken,
      });

      logger.info({
        message: "Retrieved Plaid auth data",
        category: "api",
        source: "plaid",
        metadata: {
          accountsCount: response.data.accounts.length,
          requestId: response.data.request_id,
        },
      });

      return {
        accounts: response.data.accounts,
        numbers: response.data.numbers,
      };
    } catch (error) {
      logger.error({
        message: `Failed to get Plaid auth data: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.stack : null,
        },
      });

      throw error;
    }
  }

  /**
   * Create a processor token for a specific account
   */
  async createProcessorToken(
    accessToken: string,
    accountId: string,
    processor: string,
  ) {
    if (!this.isInitialized() || !this.client) {
      throw new Error("Plaid client not initialized");
    }

    try {
      logger.info({
        message: `Creating Plaid processor token for processor ${processor}`,
        category: "api",
        source: "plaid",
        metadata: { accountId },
      });

      const request: ProcessorTokenCreateRequest = {
        access_token: accessToken,
        account_id: accountId,
        processor: processor as any,
      };

      const response = await this.client.processorTokenCreate(request);

      logger.info({
        message: `Created Plaid processor token for processor ${processor}`,
        category: "api",
        source: "plaid",
        metadata: {
          accountId,
          requestId: response.data.request_id,
        },
      });

      return {
        processorToken: response.data.processor_token,
        requestId: response.data.request_id,
      };
    } catch (error) {
      logger.error({
        message: `Failed to create Plaid processor token: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: {
          accountId,
          processor,
          error: error instanceof Error ? error.stack : null,
        },
      });

      throw error;
    }
  }

  /**
   * Create a transfer
   */
  async createTransfer(params: PlaidTransferParams) {
    if (!this.isInitialized() || !this.client) {
      throw new Error("Plaid client not initialized");
    }

    try {
      const {
        accessToken,
        accountId,
        amount,
        description,
        achClass = "ppd",
        userId,
        customerId,
        metadata,
      } = params;

      // First, create a processor token
      const { processorToken } = await this.createProcessorToken(
        accessToken,
        accountId,
        "transfer",
      );

      // Prepare transfer request
      const transferRequest: TransferCreateRequest = {
        access_token: accessToken,
        account_id: accountId,
        authorization_id: processorToken, // Using processor token as authorization
        type: TransferType.Debit, // Pull money from user's account
        network: TransferNetwork.Ach,
        amount: amount.toString(),
        description: description,
        ach_class: achClass as any,
        user: {
          legal_name: userId || "Unknown User",
        },
      };

      // Add optional user metadata
      if (metadata) {
        transferRequest.metadata = metadata;
      }

      logger.info({
        message: "Creating Plaid transfer",
        category: "api",
        source: "plaid",
        metadata: {
          accountId,
          amount,
          description,
        },
      });

      const response = await this.client.transferCreate(transferRequest);

      logger.info({
        message: "Created Plaid transfer",
        category: "api",
        source: "plaid",
        metadata: {
          transferId: response.data.transfer.id,
          status: response.data.transfer.status,
          requestId: response.data.request_id,
        },
      });

      return {
        transferId: response.data.transfer.id,
        status: response.data.transfer.status,
        requestId: response.data.request_id,
      };
    } catch (error) {
      logger.error({
        message: `Failed to create Plaid transfer: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: {
          accountId: params.accountId,
          amount: params.amount,
          error: error instanceof Error ? error.stack : null,
        },
      });

      throw error;
    }
  }

  /**
   * Create an asset report with enhanced options
   */
  async createAssetReport(params: PlaidAssetReportParams) {
    if (!this.isInitialized() || !this.client) {
      throw new Error("Plaid client not initialized");
    }

    try {
      const { accessToken, daysRequested, clientReportId, webhook, user } = params;

      logger.info({
        message: "Creating Plaid asset report",
        category: "api",
        source: "plaid",
        metadata: { daysRequested },
      });

      // Prepare asset report request with options
      const options: any = {};
      
      // Add optional parameters if provided
      if (clientReportId) {
        options.client_report_id = clientReportId;
      }

      if (webhook) {
        options.webhook = webhook;
      }

      if (user) {
        const userData: any = {
          client_user_id: user.clientUserId,
        };

        if (user.firstName) userData.first_name = user.firstName;
        if (user.lastName) userData.last_name = user.lastName;
        if (user.ssn) userData.ssn = user.ssn;
        if (user.phoneNumber) userData.phone_number = user.phoneNumber;
        if (user.email) userData.email = user.email;
        
        options.user = userData;
      }
      
      const request: AssetReportCreateRequest = {
        access_tokens: [accessToken],
        days_requested: daysRequested,
        options: options,
      };

      const response = await this.client.assetReportCreate(request);

      logger.info({
        message: "Created Plaid asset report",
        category: "api",
        source: "plaid",
        metadata: {
          assetReportId: response.data.asset_report_id,
          assetReportToken: response.data.asset_report_token,
          requestId: response.data.request_id,
        },
      });

      return {
        assetReportId: response.data.asset_report_id,
        assetReportToken: response.data.asset_report_token,
        requestId: response.data.request_id,
      };
    } catch (error) {
      logger.error({
        message: `Failed to create Plaid asset report: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: {
          daysRequested: params.daysRequested,
          error: error instanceof Error ? error.stack : null,
        },
      });

      throw error;
    }
  }
  
  /**
   * Legacy method for backward compatibility
   */
  async createAssetReportLegacy(
    accessToken: string,
    daysRequested: number = 60,
    options?: any,
  ) {
    return this.createAssetReport({
      accessToken,
      daysRequested,
      ...options
    });
  }

  /**
   * Get an asset report
   */
  async getAssetReport(
    assetReportToken: string,
    includeInsights: boolean = false,
  ) {
    if (!this.isInitialized() || !this.client) {
      throw new Error("Plaid client not initialized");
    }

    try {
      logger.info({
        message: "Getting Plaid asset report",
        category: "api",
        source: "plaid",
        metadata: { includeInsights },
      });

      const response = await this.client.assetReportGet({
        asset_report_token: assetReportToken,
        include_insights: includeInsights,
      });

      logger.info({
        message: "Retrieved Plaid asset report",
        category: "api",
        source: "plaid",
        metadata: {
          reportId: response.data.report.asset_report_id,
          userCount: response.data.report.items.length,
          requestId: response.data.request_id,
        },
      });

      return {
        report: response.data.report,
        warnings: response.data.warnings,
        requestId: response.data.request_id,
      };
    } catch (error) {
      logger.error({
        message: `Failed to get Plaid asset report: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: {
          assetReportToken,
          error: error instanceof Error ? error.stack : null,
        },
      });

      throw error;
    }
  }

  /**
   * Validate Plaid credentials by trying to create a link token
   */
  async validateCredentials(): Promise<boolean> {
    if (!this.isInitialized() || !this.client) {
      return false;
    }

    try {
      // Attempt to create a test link token
      await this.createLinkToken({
        userId: "validation-test",
        clientUserId: "validation-test",
        products: [Products.Auth],
      });

      return true;
    } catch (error) {
      logger.error({
        message: `Plaid credential validation failed: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: {
          error: error instanceof Error ? error.stack : null,
        },
      });

      return false;
    }
  }

  /**
   * Analyze asset report data for underwriting purposes
   * This extracts financial information relevant to the underwriting criteria
   */
  async analyzeAssetReportForUnderwriting(assetReportToken: string) {
    if (!this.isInitialized() || !this.client) {
      throw new Error("Plaid client not initialized");
    }

    try {
      // Get the asset report with insights for more detailed transaction data
      const { report } = await this.getAssetReport(assetReportToken, true);
      
      // Initialize analysis result
      const analysis = {
        // Income analysis
        income: {
          annualIncome: 0,
          incomeStreams: [],
          confidenceScore: 0,
        },
        
        // Employment analysis based on direct deposits
        employment: {
          employmentMonths: 0,
          employers: [],
          confidenceScore: 0,
        },
        
        // Debt analysis
        debt: {
          monthlyDebtPayments: 0,
          identifiedDebts: [],
          dtiRatio: 0,
        },
        
        // Housing payment analysis
        housing: {
          housingStatus: 'unknown',
          monthlyPayment: 0,
          paymentHistoryMonths: 0,
          consistencyScore: 0,
        },
        
        // Delinquency analysis
        delinquency: {
          overdraftCount: 0,
          insufficientFundsCount: 0,
          lateFeeCount: 0,
          lastDelinquencyDate: null,
        },
        
        // Raw data summary (not the full report)
        summary: {
          numberOfAccounts: 0,
          totalBalance: 0,
          accountTypes: [],
          oldestAccountMonths: 0,
        },
      };

      // Process each item (financial institution)
      report.items.forEach(item => {
        // Process each account
        item.accounts.forEach(account => {
          // Add to summary
          analysis.summary.numberOfAccounts++;
          analysis.summary.totalBalance += account.balances.current || 0;
          
          if (!analysis.summary.accountTypes.includes(account.type)) {
            analysis.summary.accountTypes.push(account.type);
          }
          
          // Calculate account age in months if available
          if (account.days_available) {
            const accountAgeMonths = Math.floor(account.days_available / 30);
            if (accountAgeMonths > analysis.summary.oldestAccountMonths) {
              analysis.summary.oldestAccountMonths = accountAgeMonths;
            }
          }
          
          // If we have transaction history, analyze it
          if (account.transactions && account.transactions.length > 0) {
            this.analyzeTransactionsForUnderwriting(account.transactions, analysis);
          }
        });
      });
      
      // Calculate DTI ratio if we have both income and debt data
      if (analysis.income.annualIncome > 0) {
        const monthlyIncome = analysis.income.annualIncome / 12;
        analysis.debt.dtiRatio = analysis.debt.monthlyDebtPayments / monthlyIncome;
      }
      
      return analysis;
    } catch (error) {
      logger.error({
        message: `Failed to analyze asset report for underwriting: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: {
          assetReportToken,
          error: error instanceof Error ? error.stack : null,
        },
      });
      
      throw error;
    }
  }
  
  /**
   * Helper method to analyze transactions for underwriting criteria
   */
  private analyzeTransactionsForUnderwriting(transactions: any[], analysis: any) {
    // Group transactions by month for pattern recognition
    const transactionsByMonth = {};
    const currentDate = new Date();
    
    // Pattern matchers
    const incomePatterns = [
      /direct deposit/i,
      /salary/i,
      /payroll/i,
      /income/i,
      /deposit/i,
    ];
    
    const debtPatterns = [
      /loan payment/i,
      /credit card payment/i,
      /mortgage/i,
      /student loan/i,
      /car payment/i,
      /auto loan/i,
    ];
    
    const housingPatterns = [
      /rent/i,
      /mortgage/i,
      /lease/i,
      /housing/i,
    ];
    
    const delinquencyPatterns = [
      /overdraft/i,
      /nsf/i,
      /insufficient funds/i,
      /late fee/i,
      /return fee/i,
      /overdrawn/i,
    ];
    
    // Employer detection
    const employerNames = new Set();
    
    // Process each transaction
    transactions.forEach(transaction => {
      const transactionDate = new Date(transaction.date);
      const monthKey = `${transactionDate.getFullYear()}-${transactionDate.getMonth() + 1}`;
      
      if (!transactionsByMonth[monthKey]) {
        transactionsByMonth[monthKey] = [];
      }
      
      transactionsByMonth[monthKey].push(transaction);
      
      // Check for income patterns
      if (transaction.amount > 0 && incomePatterns.some(pattern => pattern.test(transaction.name))) {
        // Identify potential income stream
        const potentialEmployer = transaction.name.replace(/(direct deposit|payroll|salary|income|deposit)/i, '').trim();
        if (potentialEmployer) {
          employerNames.add(potentialEmployer);
        }
        
        // Add to annual income (we'll divide by timeframe later)
        analysis.income.annualIncome += transaction.amount;
      }
      
      // Check for debt payment patterns
      if (transaction.amount < 0 && debtPatterns.some(pattern => pattern.test(transaction.name))) {
        // Add to monthly debt payments
        analysis.debt.monthlyDebtPayments += Math.abs(transaction.amount);
        
        // Record the debt type
        const debtType = transaction.name.trim();
        if (!analysis.debt.identifiedDebts.includes(debtType)) {
          analysis.debt.identifiedDebts.push(debtType);
        }
      }
      
      // Check for housing payment patterns
      if (transaction.amount < 0 && housingPatterns.some(pattern => pattern.test(transaction.name))) {
        // Set housing payment type
        if (/mortgage/i.test(transaction.name)) {
          analysis.housing.housingStatus = 'mortgage';
        } else if (/rent/i.test(transaction.name)) {
          analysis.housing.housingStatus = 'rent';
        }
        
        // Add to monthly housing payment
        analysis.housing.monthlyPayment = Math.max(analysis.housing.monthlyPayment, Math.abs(transaction.amount));
        
        // Increment payment history months
        analysis.housing.paymentHistoryMonths++;
      }
      
      // Check for delinquency patterns
      if (delinquencyPatterns.some(pattern => pattern.test(transaction.name))) {
        if (/overdraft/i.test(transaction.name)) {
          analysis.delinquency.overdraftCount++;
        } else if (/nsf|insufficient funds/i.test(transaction.name)) {
          analysis.delinquency.insufficientFundsCount++;
        } else if (/late fee/i.test(transaction.name)) {
          analysis.delinquency.lateFeeCount++;
        }
        
        // Update last delinquency date
        if (!analysis.delinquency.lastDelinquencyDate || 
            transactionDate > new Date(analysis.delinquency.lastDelinquencyDate)) {
          analysis.delinquency.lastDelinquencyDate = transaction.date;
        }
      }
    });
    
    // Calculate timeframe in months
    const monthKeys = Object.keys(transactionsByMonth);
    const transactionMonths = monthKeys.length;
    
    if (transactionMonths > 0) {
      // Adjust annual income based on available months of data
      if (analysis.income.annualIncome > 0) {
        analysis.income.annualIncome = (analysis.income.annualIncome / transactionMonths) * 12;
      }
      
      // Adjust employment months (set to history length if > 0)
      if (employerNames.size > 0) {
        analysis.employment.employmentMonths = transactionMonths;
        analysis.employment.employers = Array.from(employerNames);
      }
      
      // Assess confidence scores
      // Income confidence based on consistency of deposits
      const consistentMonthsWithIncome = Object.values(transactionsByMonth)
        .filter((monthTransactions: any[]) => 
          monthTransactions.some(t => t.amount > 0 && incomePatterns.some(p => p.test(t.name))))
        .length;
        
      analysis.income.confidenceScore = (consistentMonthsWithIncome / transactionMonths) * 100;
      
      // Employment confidence
      analysis.employment.confidenceScore = (employerNames.size > 0) 
        ? (consistentMonthsWithIncome / transactionMonths) * 100
        : 0;
        
      // Housing payment consistency
      const monthsWithHousingPayments = Object.values(transactionsByMonth)
        .filter((monthTransactions: any[]) => 
          monthTransactions.some(t => t.amount < 0 && housingPatterns.some(p => p.test(t.name))))
        .length;
        
      analysis.housing.consistencyScore = (monthsWithHousingPayments / transactionMonths) * 100;
    }
  }
}

export const plaidService = new PlaidService();
// Export the client too for direct access
export const plaidClient = plaidService;
