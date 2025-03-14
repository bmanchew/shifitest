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
   * Create an asset report
   */
  async createAssetReport(
    accessToken: string,
    daysRequested: number = 60,
    options?: any,
  ) {
    if (!this.isInitialized() || !this.client) {
      throw new Error("Plaid client not initialized");
    }

    try {
      logger.info({
        message: "Creating Plaid asset report",
        category: "api",
        source: "plaid",
        metadata: { daysRequested },
      });

      // Prepare asset report request
      const request: AssetReportCreateRequest = {
        access_tokens: [accessToken],
        days_requested: daysRequested,
        options: options || {},
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
          daysRequested,
          error: error instanceof Error ? error.stack : null,
        },
      });

      throw error;
    }
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
   * Create an asset report for a specific user by phone number
   * This is a helper method that finds the user by phone number and creates an asset report
   */
  async createAssetReportByPhone(
    accessToken: string,
    phoneNumber: string,
    daysRequested: number = 60,
    options?: any,
  ) {
    if (!this.isInitialized() || !this.client) {
      throw new Error("Plaid client not initialized");
    }
    
    // Import storage here to avoid circular dependency
    const { storage } = await import('../storage');
    
    try {
      // Find the user by phone number
      const user = await storage.getUserByPhone(phoneNumber);
      
      if (!user) {
        throw new Error(`User with phone number ${phoneNumber} not found`);
      }

      logger.info({
        message: `Creating Plaid asset report for user with phone ${phoneNumber}`,
        category: "api",
        source: "plaid",
        metadata: { userId: user.id, daysRequested },
      });
      
      // Get user's recent contracts
      const contracts = await storage.getContractsByCustomerId(user.id);
      
      if (!contracts || contracts.length === 0) {
        throw new Error(`No contracts found for user with phone ${phoneNumber}`);
      }
      
      // Use the most recent contract
      const contractId = contracts[0].id;
      
      // Create the asset report
      const result = await this.createAssetReport(accessToken, daysRequested, options);
      
      // Store the asset report token in our database
      await storage.storeAssetReportToken(contractId, result.assetReportToken, result.assetReportId, {
        userId: user.id,
        daysRequested
      });
      
      return {
        ...result,
        userId: user.id,
        contractId
      };
    } catch (error) {
      logger.error({
        message: `Failed to create asset report by phone: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: {
          phoneNumber,
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
   * Extracts key financial metrics used in credit decisioning
   */
  async analyzeAssetReportForUnderwriting(assetReportToken: string): Promise<any> {
    if (!this.isInitialized() || !this.client) {
      throw new Error("Plaid client not initialized");
    }

    try {
      logger.info({
        message: "Analyzing Plaid asset report for underwriting",
        category: "api",
        source: "plaid",
        metadata: { assetReportToken },
      });

      // Fetch the asset report with insights for better analysis
      const assetReport = await this.getAssetReport(assetReportToken, true);
      const report = assetReport.report;

      if (!report || !report.items || report.items.length === 0) {
        throw new Error("Asset report contains no items");
      }

      // Extract key financial metrics
      const accounts = report.items.flatMap(item => item.accounts || []);
      
      // Calculate income estimate (monthly income * 12)
      const incomeStreams = report.items
        .flatMap(item => item.income_streams || [])
        .filter(stream => stream.confidence > 0.5);
      
      const monthlyIncome = incomeStreams.reduce((sum, stream) => sum + (stream.monthly_income || 0), 0);
      const annualIncome = monthlyIncome * 12;
      
      // Extract employment data from income streams
      const employmentMonths = Math.max(
        ...incomeStreams.map(stream => stream.days / 30),
        0
      );
      
      // Calculate debt-to-income ratio
      const totalDebt = accounts
        .filter(account => account.type === 'loan' || account.type === 'credit')
        .reduce((sum, account) => {
          // For credit accounts, use balance as debt
          if (account.type === 'credit') {
            return sum + (account.balances.current || 0);
          }
          
          // For loan accounts, use outstanding balance
          return sum + (account.balances.current || 0);
        }, 0);
      
      const dtiRatio = monthlyIncome > 0 ? totalDebt / (monthlyIncome * 12) : 0;
      
      // Analyze housing status
      const housingAccount = accounts.find(account => 
        account.name.toLowerCase().includes('mortgage') || 
        account.name.toLowerCase().includes('rent') ||
        account.subtype === 'mortgage'
      );
      
      let housingStatus = 'unknown';
      let paymentHistoryMonths = 0;
      
      if (housingAccount) {
        if (housingAccount.subtype === 'mortgage') {
          housingStatus = 'mortgage';
        } else if (housingAccount.name.toLowerCase().includes('rent')) {
          housingStatus = 'rent';
        }
        
        // Estimate payment history from transaction data
        const paymentCount = report.items
          .flatMap(item => item.transactions || [])
          .filter(transaction => 
            transaction.name.toLowerCase().includes('mortgage') || 
            transaction.name.toLowerCase().includes('rent')
          ).length;
          
        paymentHistoryMonths = Math.min(Math.ceil(paymentCount), 24); // Cap at 24 months
      }
      
      // Construct the analysis object with all metrics
      const analysis = {
        income: {
          annualIncome,
          monthlyIncome,
          incomeStreams: incomeStreams.length,
          confidence: incomeStreams.length > 0 
            ? incomeStreams.reduce((sum, stream) => sum + stream.confidence, 0) / incomeStreams.length
            : 0
        },
        employment: {
          employmentMonths,
          hasStableIncome: employmentMonths >= 12 && monthlyIncome > 0
        },
        debt: {
          totalDebt,
          dtiRatio
        },
        housing: {
          housingStatus,
          paymentHistoryMonths,
          hasStableHousing: paymentHistoryMonths >= 6
        },
        accounts: {
          totalAccounts: accounts.length,
          loansCount: accounts.filter(account => account.type === 'loan').length,
          creditCount: accounts.filter(account => account.type === 'credit').length,
          depository: accounts.filter(account => account.type === 'depository').length,
        },
        balances: {
          totalBalance: accounts.reduce((sum, account) => sum + (account.balances.current || 0), 0),
          availableFunds: accounts
            .filter(account => account.type === 'depository')
            .reduce((sum, account) => sum + (account.balances.available || 0), 0)
        }
      };
      
      logger.info({
        message: "Completed Plaid asset report analysis for underwriting",
        category: "api",
        source: "plaid",
        metadata: { 
          analysisMetrics: {
            income: analysis.income.annualIncome,
            dti: analysis.debt.dtiRatio,
            employmentMonths: analysis.employment.employmentMonths
          }
        },
      });
      
      return analysis;
    } catch (error) {
      logger.error({
        message: `Failed to analyze asset report: ${error instanceof Error ? error.message : String(error)}`,
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
}

export const plaidService = new PlaidService();
