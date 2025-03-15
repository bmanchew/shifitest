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
  PaymentInitiationRecipientCreateRequest,
  PaymentInitiationPaymentCreateRequest,
  TransferAuthorizationCreateRequest,
  TransferIntentCreateRequest,
  BankTransferNetwork,
  BankTransferType,
  TransferIntentGet,
  PaymentInitiationConsentCreateRequest,
  TransferOriginatorGetRequest,
  TransferOriginatorCreateRequest,
  TransferQuestionnaireCreateRequest,
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

interface PlaidMerchantOnboardingParams {
  merchantId: number;
  legalName: string;
  email: string;
  redirectUri?: string;
}

interface PlaidPlatformPaymentParams {
  amount: number;
  merchantId: number;
  contractId: number;
  description: string;
  routeToShifi: boolean;
  facilitatorFee?: number; // Optional fee that ShiFi collects as platform
  metadata?: Record<string, string>;
}

// Custom types for Plaid API responses
export interface PlaidOriginator {
  originator_id: string;
  company_name: string;
  status: string;
  created_at: string;
  // Add other properties as needed
}

export interface PlaidDetailedOriginator extends PlaidOriginator {
  // Additional fields for detailed originator
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
  
  // Method to expose the Plaid client for test endpoints only
  getClient(): PlaidApi {
    if (!this.isInitialized() || !this.client) {
      throw new Error("Plaid client not initialized");
    }
    return this.client;
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
        auth: {
          same_day_microdeposits_enabled: true,
          sms_microdeposits_verification_enabled: true
        }
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

  /**
   * Create a merchant onboarding link for Plaid Platform Payments
   */
  async createMerchantOnboardingLink(params: PlaidMerchantOnboardingParams) {
    if (!this.isInitialized() || !this.client) {
      throw new Error("Plaid client not initialized");
    }

    // Import storage here to avoid circular dependency
    const { storage } = await import('../storage');

    try {
      const { merchantId, legalName, email, redirectUri } = params;
      
      logger.info({
        message: `Creating Plaid merchant onboarding link for merchant ${merchantId}`,
        category: "api",
        source: "plaid",
        metadata: { merchantId, legalName },
      });

      // First check if there's already a merchant in our database
      const existingPlaidMerchant = await storage.getPlaidMerchantByMerchantId(merchantId);
      
      // If merchant already exists with completed status, return error
      if (existingPlaidMerchant && existingPlaidMerchant.onboardingStatus === 'completed') {
        return {
          merchantId: existingPlaidMerchant.merchantId,
          plaidCustomerId: existingPlaidMerchant.plaidCustomerId,
          onboardingStatus: existingPlaidMerchant.onboardingStatus,
          alreadyOnboarded: true
        };
      }
      
      // Create a unique client user ID for the merchant
      const clientUserId = `merchant-${merchantId}-${Date.now()}`;
      
      // Set up user for link token
      const user = {
        client_user_id: clientUserId,
        legal_name: legalName,
        email_address: email
      };
      
      // Create link token with payment_initiation product
      const request: LinkTokenCreateRequest = {
        user,
        client_name: "ShiFi Financial",
        products: [Products.PaymentInitiation, Products.Auth, Products.Transfer],
        country_codes: [CountryCode.Us],
        language: "en",
        webhook: `${process.env.PUBLIC_URL || "https://api.shifi.com"}/api/plaid/merchant-webhook`,
      };

      // Add optional redirect URI if provided
      if (redirectUri) {
        request.redirect_uri = redirectUri;
      }
      
      const response = await this.client.linkTokenCreate(request);
      
      logger.info({
        message: `Created Plaid merchant onboarding link for merchant ${merchantId}`,
        category: "api",
        source: "plaid",
        metadata: {
          merchantId,
          linkToken: response.data.link_token,
          expiration: response.data.expiration,
        },
      });

      // Store or update the plaid merchant record
      let plaidMerchantRecord;
      if (existingPlaidMerchant) {
        // Update existing record
        plaidMerchantRecord = await storage.updatePlaidMerchant(existingPlaidMerchant.id, {
          onboardingStatus: 'in_progress',
          onboardingUrl: response.data.link_token
        });
      } else {
        // Create new record
        plaidMerchantRecord = await storage.createPlaidMerchant({
          merchantId,
          onboardingStatus: 'in_progress',
          onboardingUrl: response.data.link_token,
        });
      }

      return {
        merchantId,
        linkToken: response.data.link_token,
        expiration: response.data.expiration,
        plaidMerchantId: plaidMerchantRecord.id
      };
    } catch (error) {
      logger.error({
        message: `Failed to create Plaid merchant onboarding link: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: {
          merchantId: params.merchantId,
          error: error instanceof Error ? error.stack : null,
        },
      });

      throw error;
    }
  }

  /**
   * Complete merchant onboarding after Plaid Link flow
   */
  async completeMerchantOnboarding(merchantId: number, publicToken: string, accountId: string, originatorId?: string, questionnaireId?: string) {
    if (!this.isInitialized() || !this.client) {
      throw new Error("Plaid client not initialized");
    }

    // Import storage here to avoid circular dependency
    const { storage } = await import('../storage');

    try {
      logger.info({
        message: `Completing Plaid merchant onboarding for merchant ${merchantId}`,
        category: "api",
        source: "plaid",
        metadata: { merchantId, accountId, originatorId, questionnaireId },
      });

      // First, exchange the public token for an access token
      const { accessToken, itemId } = await this.exchangePublicToken(publicToken);
      
      // Get the merchant from our database
      const merchant = await storage.getMerchant(merchantId);
      if (!merchant) {
        throw new Error(`Merchant with ID ${merchantId} not found`);
      }
      
      // Get plaid merchant record or create if not exists
      let plaidMerchant = await storage.getPlaidMerchantByMerchantId(merchantId);
      
      if (!plaidMerchant) {
        // Create new record if one doesn't exist yet
        plaidMerchant = await storage.createPlaidMerchant({
          merchantId,
          onboardingStatus: 'in_progress',
          accessToken,
          accountId,
          originatorId,
          questionnaireId
        });
      } else {
        // Update existing record
        plaidMerchant = await storage.updatePlaidMerchant(plaidMerchant.id, {
          accessToken,
          accountId,
          defaultFundingAccount: accountId,
          originatorId,
          questionnaireId
        });
      }
      
      // If we have an originatorId, check the status with Plaid
      if (originatorId) {
        try {
          const originatorStatus = await this.getMerchantOnboardingStatus(originatorId);
          
          // Log the status we received from Plaid
          logger.info({
            message: `Received originator status from Plaid: ${originatorStatus.status}`,
            category: "api",
            source: "plaid",
            metadata: { 
              merchantId,
              originatorId,
              status: originatorStatus.status 
            }
          });
          
          // Only mark as completed if Plaid says it's active
          // Otherwise keep it as in_progress
          if (originatorStatus.status.toLowerCase() === 'active') {
            // Mark onboarding as complete
            const updatedPlaidMerchant = await storage.updatePlaidMerchant(plaidMerchant.id, {
              onboardingStatus: 'completed'
            });
            
            return {
              merchantId,
              plaidMerchantId: updatedPlaidMerchant.id,
              status: updatedPlaidMerchant.onboardingStatus,
              accessToken,
              accountId,
              originatorId,
              originatorStatus: originatorStatus.status
            };
          } else {
            // Originator exists but isn't active yet
            return {
              merchantId,
              plaidMerchantId: plaidMerchant.id,
              status: 'in_progress',
              accessToken,
              accountId,
              originatorId,
              originatorStatus: originatorStatus.status
            };
          }
        } catch (originatorError) {
          // Log error but continue - we'll mark as in_progress
          logger.warn({
            message: `Failed to check originator status with Plaid: ${originatorError instanceof Error ? originatorError.message : String(originatorError)}`,
            category: "api",
            source: "plaid",
            metadata: {
              merchantId,
              originatorId,
              error: originatorError instanceof Error ? originatorError.stack : null,
            },
          });
        }
      }
      
      // Mark onboarding as complete (this is the original behavior if we don't have an originatorId)
      const updatedPlaidMerchant = await storage.updatePlaidMerchant(plaidMerchant.id, {
        onboardingStatus: 'completed'
      });

      return {
        merchantId,
        plaidMerchantId: updatedPlaidMerchant.id,
        status: updatedPlaidMerchant.onboardingStatus,
        accessToken,
        accountId,
        originatorId
      };
    } catch (error) {
      logger.error({
        message: `Failed to complete Plaid merchant onboarding: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: {
          merchantId,
          error: error instanceof Error ? error.stack : null,
        },
      });

      throw error;
    }
  }

  /**
   * Check the onboarding status of a merchant with Plaid using /transfer/originator/get
   */
  async getMerchantOnboardingStatus(originatorId: string) {
    if (!this.isInitialized() || !this.client) {
      throw new Error("Plaid client not initialized");
    }

    try {
      logger.info({
        message: `Checking Plaid merchant onboarding status for originator ${originatorId}`,
        category: "api",
        source: "plaid",
        metadata: { originatorId },
      });

      // Create request for transfer/originator/get
      const request: TransferOriginatorGetRequest = {
        originator_id: originatorId,
      };

      const response = await this.client.transferOriginatorGet(request);

      logger.info({
        message: `Retrieved Plaid merchant onboarding status for originator ${originatorId}`,
        category: "api",
        source: "plaid",
        metadata: {
          originatorId,
          status: response.data.originator.status,
          requestId: response.data.request_id,
        },
      });

      return {
        originatorId: response.data.originator.originator_id,
        originatorName: response.data.originator.company_name,
        status: response.data.originator.status,
        createdAt: response.data.originator.created_at,
        requestId: response.data.request_id,
      };
    } catch (error) {
      logger.error({
        message: `Failed to check Plaid merchant onboarding status: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: {
          originatorId,
          error: error instanceof Error ? error.stack : null,
        },
      });

      throw error;
    }
  }

  /**
   * Create a platform payment transfer - route funds between customers and merchants or ShiFi
   */
  async createPlatformPayment(params: PlaidPlatformPaymentParams) {
    if (!this.isInitialized() || !this.client) {
      throw new Error("Plaid client not initialized");
    }

    // Import storage here to avoid circular dependency
    const { storage } = await import('../storage');

    try {
      const { amount, merchantId, contractId, description, routeToShifi, facilitatorFee, metadata } = params;

      logger.info({
        message: `Creating Plaid platform payment for contract ${contractId}`,
        category: "api",
        source: "plaid",
        metadata: {
          amount,
          merchantId,
          contractId,
          routeToShifi
        },
      });

      // Get the contract to check ownership
      const contract = await storage.getContract(contractId);
      if (!contract) {
        throw new Error(`Contract with ID ${contractId} not found`);
      }

      // Verify contract belongs to the merchant
      if (contract.merchantId !== merchantId) {
        throw new Error(`Contract ${contractId} does not belong to merchant ${merchantId}`);
      }

      // Get Plaid merchant data
      const plaidMerchant = await storage.getPlaidMerchantByMerchantId(merchantId);
      if (!plaidMerchant) {
        throw new Error(`Merchant ${merchantId} is not onboarded with Plaid`);
      }
      
      if (plaidMerchant.onboardingStatus !== 'completed') {
        throw new Error(`Merchant ${merchantId} has not completed Plaid onboarding`);
      }
      
      // Determine routing destination based on:
      // 1. The explicit routeToShifi parameter (which overrides contract status)
      // 2. If the contract is owned by ShiFi (purchased)
      
      // If routeToShifi is explicitly set to true, we'll route to ShiFi regardless of contract status
      // Otherwise, check if the contract has been purchased by ShiFi
      const shouldRouteToShifi = routeToShifi || (contract.purchasedByShifi === true);
      
      logger.info({
        message: `Determining payment routing for contract ${contractId}`,
        category: "api",
        source: "plaid",
        metadata: {
          contractId,
          merchantId,
          routeToShifiParameter: routeToShifi,
          contractPurchasedByShifi: contract.purchasedByShifi,
          finalRouting: shouldRouteToShifi ? "ShiFi" : "Merchant",
        },
      });

      // Determine the destination account based on routing flag
      const destination = routeToShifi 
        ? process.env.SHIFI_PLAID_ACCOUNT_ID 
        : plaidMerchant.defaultFundingAccount || plaidMerchant.accountId;
      
      if (!destination) {
        throw new Error("No destination account available for transfer");
      }
      
      // Create a transfer intent
      const transferIntentRequest: any = {
        amount: amount.toString(),
        description,
        account_id: destination,
        user: {
          legal_name: `Contract ${contractId}`,
        },
        mode: routeToShifi ? "PAYMENT" : "DISBURSEMENT", // TransferIntentCreateMode needs casting in some versions of the SDK
        ach_class: "ppd", // ACHClass needs casting in some versions of the SDK
        funding_account_id: destination,
      };
      
      // Add facilitator fee if provided (fee that ShiFi collects as a platform)
      if (facilitatorFee && facilitatorFee > 0) {
        // Since we're using the Plaid SDK, we'll need to cast to 'any' to add this property
        // because it might not be in the TypeScript type definition yet
        (transferIntentRequest as any).facilitator_fee = {
          amount: facilitatorFee.toString()
        };
      }
      
      // Create the transfer intent
      const intentResponse = await this.client.transferIntentCreate(transferIntentRequest);
      
      // Record the transfer in our database
      const transferRecord = await storage.createPlaidTransfer({
        contractId,
        merchantId,
        transferId: intentResponse.data.transfer_intent.id,
        amount,
        description,
        type: routeToShifi ? "credit" : "debit",
        status: intentResponse.data.transfer_intent.status,
        routedToShifi: routeToShifi,
        facilitatorFee: facilitatorFee,
        metadata: metadata ? JSON.stringify(metadata) : undefined
      });

      return {
        transferId: intentResponse.data.transfer_intent.id,
        status: intentResponse.data.transfer_intent.status,
        amount,
        routedToShifi: routeToShifi,
        transferRecordId: transferRecord.id
      };
    } catch (error) {
      logger.error({
        message: `Failed to create Plaid platform payment: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: {
          contractId: params.contractId,
          merchantId: params.merchantId,
          amount: params.amount,
          error: error instanceof Error ? error.stack : null,
        },
      });

      throw error;
    }
  }

  /**
   * Get all merchants that are active in Plaid for transfers
   * Returns merchants who have completed onboarding and have active accounts
   */
  async getActivePlaidMerchants() {
    if (!this.isInitialized() || !this.client) {
      throw new Error("Plaid client not initialized");
    }

    // Import storage here to avoid circular dependency
    const { storage } = await import('../storage');

    try {
      logger.info({
        message: "Getting active Plaid merchants for transfers",
        category: "api",
        source: "plaid",
      });

      // First, use the /transfer/originator/list endpoint to get all merchants from Plaid
      const originatorsResponse = await this.client.transferOriginatorList({});
      const plaidOriginators = originatorsResponse.data.originators || [];
      
      logger.info({
        message: `Retrieved ${plaidOriginators.length} originators from Plaid API`,
        category: "api",
        source: "plaid",
      });
      
      if (plaidOriginators.length === 0) {
        logger.info({
          message: "No merchants found in Plaid platform",
          category: "api",
          source: "plaid",
        });
        return [];
      }
      
      // Map the Plaid originators to our merchant data structure
      const activeMerchants = [];
      
      for (const originator of plaidOriginators) {
        try {
          // Only include active originators
          if (originator.status !== 'active') {
            logger.info({
              message: `Skipping non-active originator: ${originator.originator_id} with status ${originator.status}`,
              category: "api",
              source: "plaid",
            });
            continue;
          }
          
          // Try to find this originator in our database to get the merchant ID
          const plaidMerchant = await storage.getPlaidMerchantByOriginatorId(originator.originator_id);
          
          const merchantData: any = {
            originatorId: originator.originator_id,
            originatorName: originator.company_name,
            status: originator.status,
            createdAt: originator.created_at,
          };
          
          // If we have this originator in our database, add the merchant details
          if (plaidMerchant) {
            merchantData.merchantId = plaidMerchant.merchantId;
            merchantData.plaidMerchantId = plaidMerchant.id;
            merchantData.accessToken = plaidMerchant.accessToken || '';
            merchantData.accountId = plaidMerchant.accountId || '';
            merchantData.defaultFundingAccount = plaidMerchant.defaultFundingAccount || '';
            
            // Get the merchant details from our database
            const merchant = await storage.getMerchant(plaidMerchant.merchantId);
            if (merchant) {
              merchantData.merchantName = merchant.name;
              merchantData.merchantEmail = merchant.email;
            }
          } else {
            // If we don't have this originator in our database, log it
            logger.warn({
              message: `Found originator in Plaid that is not in our database: ${originator.originator_id}`,
              category: "api",
              source: "plaid",
              metadata: {
                originatorId: originator.originator_id,
                companyName: originator.company_name,
              },
            });
            
            // Include it in our results anyway since it's an active originator in Plaid
            merchantData.plaidOnly = true;
          }
          
          activeMerchants.push(merchantData);
        } catch (error) {
          // If we get an error processing this originator, log it but continue with others
          logger.warn({
            message: `Error processing Plaid originator: ${error instanceof Error ? error.message : String(error)}`,
            category: "api",
            source: "plaid",
            metadata: {
              originatorId: originator.originator_id,
              error: error instanceof Error ? error.stack : null,
            },
          });
        }
      }
      
      // As a fallback, also check our database for any merchants that may not be returned by Plaid API
      // This helps handle any potential sync issues between our database and Plaid
      const onboardedMerchants = await storage.getPlaidMerchantsByStatus('completed');
      
      for (const merchant of onboardedMerchants) {
        try {
          // Skip if we already have this merchant in our results
          if (merchant.originatorId && activeMerchants.some(m => m.originatorId === merchant.originatorId)) {
            continue;
          }
          
          if (!merchant.accessToken) {
            logger.warn({
              message: `Merchant ${merchant.merchantId} has no access token`,
              category: "api",
              source: "plaid",
            });
            continue;
          }

          // Check if the merchant's accounts are still active
          const accountsResponse = await this.client.accountsGet({
            access_token: merchant.accessToken
          });
          
          // Check if the merchant has transfer capabilities
          const hasTransferCapability = accountsResponse.data.accounts.some(account => 
            account.type === 'depository' && 
            ['checking', 'savings'].includes(account.subtype || '')
          );
          
          if (hasTransferCapability) {
            // Create merchant object with only required fields
            const merchantData: any = {
              merchantId: merchant.merchantId,
              plaidMerchantId: merchant.id,
              originatorId: merchant.originatorId,
              accessToken: merchant.accessToken || '', 
              accountId: merchant.accountId || '',
              defaultFundingAccount: merchant.defaultFundingAccount || '',
              fromDatabaseOnly: true
            };
            
            // Get the merchant details from our database
            const merchantDetails = await storage.getMerchant(merchant.merchantId);
            if (merchantDetails) {
              merchantData.merchantName = merchantDetails.name;
              merchantData.merchantEmail = merchantDetails.email;
            }
            
            activeMerchants.push(merchantData);
          }
        } catch (error) {
          // If we get an error checking this merchant, log it but continue with others
          logger.warn({
            message: `Error checking database merchant status: ${error instanceof Error ? error.message : String(error)}`,
            category: "api",
            source: "plaid",
            metadata: {
              merchantId: merchant.merchantId,
              error: error instanceof Error ? error.stack : null,
            },
          });
        }
      }
      
      return activeMerchants;
    } catch (error) {
      logger.error({
        message: `Failed to get active Plaid merchants: ${error instanceof Error ? error.message : String(error)}`,
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
   * Check status of a platform payment transfer
   */
  async checkPlatformPaymentStatus(transferId: string) {
    if (!this.isInitialized() || !this.client) {
      throw new Error("Plaid client not initialized");
    }

    // Import storage here to avoid circular dependency
    const { storage } = await import('../storage');

    try {
      logger.info({
        message: `Checking Plaid platform payment status for transfer ${transferId}`,
        category: "api",
        source: "plaid",
      });

      // Get transfer from Plaid
      const response = await this.client.transferIntentGet({
        transfer_intent_id: transferId
      });

      const status = response.data.transfer_intent.status;
      
      // Update status in our database
      const transferRecord = await storage.getPlaidTransferById(parseInt(transferId));
      if (transferRecord) {
        await storage.updatePlaidTransferStatus(transferRecord.id, status);
      }

      return {
        transferId,
        status,
        requiresAttention: ['failed', 'returned'].includes(status.toLowerCase())
      };
    } catch (error) {
      logger.error({
        message: `Failed to check Plaid platform payment status: ${error instanceof Error ? error.message : String(error)}`,
        category: "api",
        source: "plaid",
        metadata: {
          transferId,
          error: error instanceof Error ? error.stack : null,
        },
      });

      throw error;
    }
  }
}

export const plaidService = new PlaidService();
