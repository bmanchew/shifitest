import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "plaid";
import { logger } from "./logger";

// Response types
interface GetAssetReportResponse {
  report: any;
  warnings: any[];
  requestId: string;
}

interface UnderwritingAnalysis {
  income: {
    annualIncome: number;
    incomeStreams: string[];
    confidenceScore: number;
  };
  employment: {
    employmentMonths: number;
    employers: string[];
    confidenceScore: number;
  };
  debt: {
    monthlyDebtPayments: number;
    identifiedDebts: string[];
    dtiRatio: number;
  };
  housing: {
    housingStatus: string;
    monthlyPayment: number;
    paymentHistoryMonths: number;
    consistencyScore: number;
  };
  delinquency: {
    overdraftCount: number;
    insufficientFundsCount: number;
    lateFeeCount: number;
    lastDelinquencyDate: string | null;
  };
  summary: {
    numberOfAccounts: number;
    totalBalance: number;
    accountTypes: string[];
    oldestAccountMonths: number;
  };
}

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
        message: "Plaid credentials not configured, functionality will be limited",
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
        products = [Products.Auth, Products.Transactions, Products.Assets],
        redirectUri,
      } = params;

      // Prepare user object for the request
      const user = {
        client_user_id: clientUserId,
        legal_name: userName,
        email_address: userEmail,
      };

      // Prepare request
      const request = {
        user,
        client_name: "ShiFi Financial",
        products: products,
        country_codes: [CountryCode.Us],
        language: "en",
        webhook: `${process.env.PUBLIC_URL || "https://api.shifi.com"}/api/plaid/webhook`,
      } as any;

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

      // Prepare asset report request
      const request = {
        access_tokens: [accessToken],
        days_requested: daysRequested,
        options: {} as any,
      };

      // Add optional parameters if provided
      if (clientReportId) {
        request.options.client_report_id = clientReportId;
      }

      if (webhook) {
        request.options.webhook = webhook;
      }

      if (user) {
        const userData = {
          client_user_id: user.clientUserId,
        } as any;

        if (user.firstName) userData.first_name = user.firstName;
        if (user.lastName) userData.last_name = user.lastName;
        if (user.ssn) userData.ssn = user.ssn;
        if (user.phoneNumber) userData.phone_number = user.phoneNumber;
        if (user.email) userData.email = user.email;
        
        request.options.user = userData;
      }

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
   * Get an asset report
   */
  async getAssetReport(
    assetReportToken: string,
    includeInsights: boolean = false,
  ): Promise<GetAssetReportResponse> {
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
   * Analyze asset report data for underwriting purposes
   * This extracts financial information relevant to the underwriting criteria
   */
  async analyzeAssetReportForUnderwriting(assetReportToken: string): Promise<UnderwritingAnalysis> {
    if (!this.isInitialized() || !this.client) {
      throw new Error("Plaid client not initialized");
    }

    try {
      // Get the asset report with insights for more detailed transaction data
      const { report } = await this.getAssetReport(assetReportToken, true);
      
      // Process the report data to extract relevant information
      const accounts = report.items.flatMap((item: any) => item.accounts);
      const transactions = accounts.flatMap((account: any) => account.transactions || []);
      
      // Calculate monthly income based on recurring deposits
      const depositAmounts = transactions
        .filter((tx: any) => tx.amount > 0 && tx.type === 'deposit')
        .map((tx: any) => tx.amount);
      const estimatedMonthlyIncome = depositAmounts.length > 0 
        ? (depositAmounts.reduce((a: number, b: number) => a + b, 0) / depositAmounts.length) 
        : 0;
      
      // Identify employment duration from transaction patterns
      const employmentMonths = Math.floor(transactions.length / 30); // Rough estimate based on transaction history
      
      // Calculate debt payments and DTI ratio
      const monthlyDebtPayments = transactions
        .filter((tx: any) => 
          tx.amount < 0 && 
          (tx.category || []).some((cat: string) => 
            ['loan', 'credit', 'debt'].includes(cat.toLowerCase())
          )
        )
        .reduce((total: number, tx: any) => total + Math.abs(tx.amount), 0) / (transactions.length / 30);
      
      const dtiRatio = monthlyDebtPayments > 0 ? (monthlyDebtPayments / estimatedMonthlyIncome) : 0;
      
      // Housing payment analysis
      const housingTransactions = transactions.filter((tx: any) => 
        (tx.category || []).some((cat: string) => 
          ['rent', 'mortgage'].includes(cat.toLowerCase())
        )
      );
      
      const housingStatus = housingTransactions.length > 0 ? 'stable' : 'unknown';
      const paymentHistoryMonths = Math.floor(housingTransactions.length);
      
      // Initialize analysis result with calculated values
      const analysis: UnderwritingAnalysis = {
        income: {
          annualIncome: estimatedMonthlyIncome * 12,
          incomeStreams: Array.from(new Set(depositAmounts.map((amount: number) => amount.toFixed(2)))),
          confidenceScore: Math.min(depositAmounts.length / 6, 1), // Higher confidence with more data points
        },
        employment: {
          employmentMonths,
          employers: Array.from(new Set(transactions
            .filter((tx: any) => tx.amount > 0 && tx.type === 'deposit')
            .map((tx: any) => tx.name)
          )),
          confidenceScore: Math.min(employmentMonths / 12, 1),
        },
        debt: {
          monthlyDebtPayments,
          identifiedDebts: Array.from(new Set(transactions
            .filter((tx: any) => tx.amount < 0 && (tx.category || []).some((cat: string) => ['loan', 'credit', 'debt'].includes(cat.toLowerCase())))
            .map((tx: any) => tx.name)
          )),
          dtiRatio,
        },
        housing: {
          housingStatus,
          monthlyPayment: housingTransactions.length > 0 
            ? Math.abs(housingTransactions[0].amount) 
            : 0,
          paymentHistoryMonths,
          consistencyScore: housingTransactions.length > 0 
            ? housingTransactions.filter((tx: any) => tx.amount < 0).length / housingTransactions.length 
            : 0,
        },
        delinquency: {
          overdraftCount: transactions.filter((tx: any) => 
            tx.amount < 0 && tx.type === 'overdraft'
          ).length,
          insufficientFundsCount: transactions.filter((tx: any) => 
            (tx.category || []).includes('insufficient_funds')
          ).length,
          lateFeeCount: transactions.filter((tx: any) => 
            (tx.category || []).includes('late_fee')
          ).length,
          lastDelinquencyDate: null, // Would need additional data to determine this
        },
        summary: {
          numberOfAccounts: accounts.length,
          totalBalance: accounts.reduce((total: number, account: any) => total + (account.balances.current || 0), 0),
          accountTypes: Array.from(new Set(accounts.map((account: any) => account.type))),
          oldestAccountMonths: Math.max(...accounts.map((account: any) => 
            account.daysAvailable ? Math.floor(account.daysAvailable / 30) : 0
          )),
        },
      };

      // Process each item (financial institution)
      for (const item of report.items) {
        // Process each account
        for (const account of item.accounts) {
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
        }
      }
      
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
   * Helper method to analyze transaction data for underwriting purposes
   * This updates the analysis object with insights from transaction data
   */
  private analyzeTransactionsForUnderwriting(transactions: any[], analysis: UnderwritingAnalysis) {
    for (const transaction of transactions) {
      // Skip pending transactions
      if (transaction.pending) continue;

      // Analyze income deposits
      if (transaction.amount > 0 && transaction.type === 'deposit') {
        // Add to income streams if not already present
        const streamId = `${transaction.name}-${transaction.amount.toFixed(2)}`;
        if (!analysis.income.incomeStreams.includes(streamId)) {
          analysis.income.incomeStreams.push(streamId);
        }

        // Update employment information if it looks like a payroll deposit
        if (transaction.name.toLowerCase().includes('payroll') || 
            transaction.name.toLowerCase().includes('direct deposit')) {
          const employer = transaction.name.replace(/(payroll|direct deposit)/i, '').trim();
          if (!analysis.employment.employers.includes(employer)) {
            analysis.employment.employers.push(employer);
          }
        }
      }

      // Analyze debt payments
      if (transaction.amount < 0 && 
          (transaction.category || []).some((cat: string) => 
            ['loan', 'credit', 'debt'].includes(cat.toLowerCase()))) {
        // Add to identified debts if not already present
        if (!analysis.debt.identifiedDebts.includes(transaction.name)) {
          analysis.debt.identifiedDebts.push(transaction.name);
        }
        analysis.debt.monthlyDebtPayments += Math.abs(transaction.amount);
      }

      // Track delinquency indicators
      if (transaction.type === 'overdraft') {
        analysis.delinquency.overdraftCount++;
      }
      if ((transaction.category || []).includes('insufficient_funds')) {
        analysis.delinquency.insufficientFundsCount++;
      }
      if ((transaction.category || []).includes('late_fee')) {
        analysis.delinquency.lateFeeCount++;
        // Update last delinquency date if this is more recent
        const txDate = new Date(transaction.date);
        if (!analysis.delinquency.lastDelinquencyDate || 
            txDate > new Date(analysis.delinquency.lastDelinquencyDate)) {
          analysis.delinquency.lastDelinquencyDate = transaction.date;
        }
      }

      // Analyze housing payments
      if ((transaction.category || []).some((cat: string) => 
          ['rent', 'mortgage'].includes(cat.toLowerCase()))) {
        analysis.housing.housingStatus = 'stable';
        if (!analysis.housing.monthlyPayment) {
          analysis.housing.monthlyPayment = Math.abs(transaction.amount);
        }
        analysis.housing.paymentHistoryMonths++;
      }
    }
  }
}

// Create and export a singleton instance
export const plaidService = new PlaidService();
export type { GetAssetReportResponse, UnderwritingAnalysis };