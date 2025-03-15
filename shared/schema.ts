import { pgTable, text, serial, integer, boolean, timestamp, doublePrecision, pgEnum, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'merchant', 'customer']);
export const contractStatusEnum = pgEnum('contract_status', ['pending', 'active', 'completed', 'declined', 'cancelled']);
export const applicationStepEnum = pgEnum('application_step', ['terms', 'kyc', 'bank', 'payment', 'signing', 'completed']);
export const logLevelEnum = pgEnum('log_level', ['debug', 'info', 'warn', 'error', 'critical']);
export const logCategoryEnum = pgEnum('log_category', ['system', 'user', 'api', 'payment', 'security', 'contract']);
export const logSourceEnum = pgEnum('log_source', ['internal', 'twilio', 'didit', 'plaid', 'thanksroger', 'prefi']);
export const creditTierEnum = pgEnum('credit_tier', ['tier1', 'tier2', 'tier3', 'declined']);
export const onboardingStatusEnum = pgEnum('onboarding_status', ['pending', 'in_progress', 'completed', 'rejected']);

// Users
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  name: text("name"), // Keep for backward compatibility
  role: userRoleEnum("role").notNull().default('customer'),
  phone: text("phone"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

// Merchants
export const merchants = pgTable("merchants", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  address: text("address"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  userId: integer("user_id").references(() => users.id),
});

export const insertMerchantSchema = createInsertSchema(merchants).omit({
  id: true,
  createdAt: true,
});

// Contracts
export const contracts = pgTable("contracts", {
  id: serial("id").primaryKey(),
  contractNumber: text("contract_number").notNull().unique(),
  merchantId: integer("merchant_id").references(() => merchants.id).notNull(),
  customerId: integer("customer_id").references(() => users.id),
  amount: doublePrecision("amount").notNull(),
  downPayment: doublePrecision("down_payment").notNull(),
  financedAmount: doublePrecision("financed_amount").notNull(),
  termMonths: integer("term_months").notNull().default(24),
  interestRate: doublePrecision("interest_rate").notNull().default(0),
  monthlyPayment: doublePrecision("monthly_payment").notNull(),
  status: contractStatusEnum("status").notNull().default('pending'),
  currentStep: applicationStepEnum("current_step").notNull().default('terms'),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  phoneNumber: text("phone_number"), // Store customer phone number directly in contract
});

export const insertContractSchema = createInsertSchema(contracts).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

// Application Progress
export const applicationProgress = pgTable("application_progress", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").references(() => contracts.id).notNull(),
  step: applicationStepEnum("step").notNull(),
  completed: boolean("completed").default(false),
  data: text("data"), // JSON stringified data specific to the step
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertApplicationProgressSchema = createInsertSchema(applicationProgress).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

// Logs
export const logs = pgTable("logs", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").defaultNow(),
  level: logLevelEnum("level").notNull().default('info'),
  category: logCategoryEnum("category").notNull().default('system'),
  message: text("message").notNull(),
  userId: integer("user_id").references(() => users.id),
  source: logSourceEnum("source").notNull().default('internal'),
  requestId: text("request_id"), // to group logs for a single request/operation
  correlationId: text("correlation_id"), // to track across multiple systems
  metadata: text("metadata"), // JSON stringified additional data
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  tags: text("tags").array(),
  duration: integer("duration"), // for measuring performance (in ms)
  statusCode: integer("status_code"), // for API responses
  retentionDays: integer("retention_days").default(90), // log retention policy
});

export const insertLogSchema = createInsertSchema(logs).omit({
  id: true,
  timestamp: true,
});

// Type definitions
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Merchant = typeof merchants.$inferSelect;
export type InsertMerchant = z.infer<typeof insertMerchantSchema>;

export type Contract = typeof contracts.$inferSelect;
export type InsertContract = z.infer<typeof insertContractSchema>;

export type ApplicationProgress = typeof applicationProgress.$inferSelect;
export type InsertApplicationProgress = z.infer<typeof insertApplicationProgressSchema>;

// Underwriting data
export const underwritingData = pgTable("underwriting_data", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  contractId: integer("contract_id").references(() => contracts.id),
  creditTier: creditTierEnum("credit_tier").notNull(),
  creditScore: integer("credit_score"),
  annualIncome: doublePrecision("annual_income"),
  annualIncomePoints: integer("annual_income_points"),
  employmentHistoryMonths: integer("employment_history_months"),
  employmentHistoryPoints: integer("employment_history_points"),
  creditScorePoints: integer("credit_score_points"),
  dtiRatio: doublePrecision("dti_ratio"),
  dtiRatioPoints: integer("dti_ratio_points"),
  housingStatus: text("housing_status"),
  housingPaymentHistory: integer("housing_payment_history_months"),
  housingStatusPoints: integer("housing_status_points"),
  delinquencyHistory: text("delinquency_history"),
  delinquencyPoints: integer("delinquency_points"),
  totalPoints: integer("total_points").notNull(),
  rawPreFiData: text("raw_prefi_data"), // JSON stringified data from Pre-Fi API
  rawPlaidData: text("raw_plaid_data"), // JSON stringified relevant Plaid data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertUnderwritingDataSchema = createInsertSchema(underwritingData).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Log = typeof logs.$inferSelect;
export type InsertLog = z.infer<typeof insertLogSchema>;

export type UnderwritingData = typeof underwritingData.$inferSelect;
export type InsertUnderwritingData = z.infer<typeof insertUnderwritingDataSchema>;

// Asset Reports
export const assetReports = pgTable("asset_reports", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  contractId: integer("contract_id").references(() => contracts.id),
  assetReportId: text("asset_report_id").notNull(),
  assetReportToken: text("asset_report_token").notNull(), // This should be encrypted in production
  plaidItemId: text("plaid_item_id"),
  daysRequested: integer("days_requested").default(60),
  status: text("status").default("pending"),
  analysisData: text("analysis_data"), // JSON stringified analysis results
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
  refreshedAt: timestamp("refreshed_at"),
});

export const portfolioMonitoring = pgTable("portfolio_monitoring", {
  id: serial("id").primaryKey(),
  lastCreditCheckDate: timestamp("last_credit_check_date"),
  lastAssetVerificationDate: timestamp("last_asset_verification_date"),
  nextCreditCheckDate: timestamp("next_credit_check_date"),
  nextAssetVerificationDate: timestamp("next_asset_verification_date"),
  portfolioHealthScore: doublePrecision("portfolio_health_score"),
  riskMetrics: text("risk_metrics"), // JSON stringified risk metrics
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const complaintsData = pgTable("complaints_data", {
  id: serial("id").primaryKey(),
  complaintId: text("complaint_id").notNull().unique(),
  product: text("product"),
  subProduct: text("sub_product"),
  issue: text("issue"),
  subIssue: text("sub_issue"),
  company: text("company"),
  state: text("state"),
  submittedVia: text("submitted_via"),
  dateReceived: timestamp("date_received"),
  complaintNarrative: text("complaint_narrative"),
  companyResponse: text("company_response"),
  timelyResponse: boolean("timely_response"),
  consumerDisputed: boolean("consumer_disputed"),
  tags: text("tags").array(),
  metadata: text("metadata"), // JSON stringified additional data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertAssetReportSchema = createInsertSchema(assetReports).omit({
  id: true,
  createdAt: true,
});

export const insertPortfolioMonitoringSchema = createInsertSchema(portfolioMonitoring).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertComplaintsDataSchema = createInsertSchema(complaintsData).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AssetReport = typeof assetReports.$inferSelect;
export type InsertAssetReport = z.infer<typeof insertAssetReportSchema>;

export type PortfolioMonitoring = typeof portfolioMonitoring.$inferSelect;
export type InsertPortfolioMonitoring = z.infer<typeof insertPortfolioMonitoringSchema>;

export type ComplaintsData = typeof complaintsData.$inferSelect;
export type InsertComplaintsData = z.infer<typeof insertComplaintsDataSchema>;

// Merchant Performance
export const merchantPerformance = pgTable("merchant_performance", {
  id: serial("id").primaryKey(),
  merchantId: integer("merchant_id").references(() => merchants.id).notNull(),
  performanceScore: doublePrecision("performance_score").notNull(),
  grade: text("grade").notNull(), // A+, A, A-, B+, etc.
  defaultRate: doublePrecision("default_rate"),
  latePaymentRate: doublePrecision("late_payment_rate"),
  avgContractValue: doublePrecision("avg_contract_value"),
  totalContracts: integer("total_contracts"),
  activeContracts: integer("active_contracts"),
  completedContracts: integer("completed_contracts"),
  cancelledContracts: integer("cancelled_contracts"),
  riskAdjustedReturn: doublePrecision("risk_adjusted_return"),
  customerSatisfactionScore: doublePrecision("customer_satisfaction_score"),
  underwritingRecommendations: text("underwriting_recommendations"), // JSON stringified AI recommendations
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMerchantPerformanceSchema = createInsertSchema(merchantPerformance).omit({
  id: true,
  createdAt: true,
});

export type MerchantPerformance = typeof merchantPerformance.$inferSelect;
export type InsertMerchantPerformance = z.infer<typeof insertMerchantPerformanceSchema>;

// Plaid Platform Payment data for merchants
export const plaidMerchants = pgTable("plaid_merchants", {
  id: serial("id").primaryKey(),
  merchantId: integer("merchant_id").references(() => merchants.id).notNull().unique(),
  plaidCustomerId: text("plaid_customer_id"), // The ID assigned by Plaid for this merchant
  originatorId: text("originator_id"), // The originator ID from Plaid
  onboardingStatus: onboardingStatusEnum("onboarding_status").notNull().default('pending'),
  onboardingUrl: text("onboarding_url"), // The URL for the merchant to complete onboarding
  questionnaireId: text("questionnaire_id"), // The ID of the onboarding questionnaire 
  plaidData: text("plaid_data"), // JSON stringified Plaid merchant data
  accessToken: text("access_token"), // The Plaid access token for this merchant
  accountId: text("account_id"), // The primary bank account ID for this merchant
  defaultFundingAccount: text("default_funding_account"), // The default account for payments
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertPlaidMerchantSchema = createInsertSchema(plaidMerchants).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PlaidMerchant = typeof plaidMerchants.$inferSelect;
export type InsertPlaidMerchant = z.infer<typeof insertPlaidMerchantSchema>;

// Plaid Transfers table to track payments
export const plaidTransfers = pgTable("plaid_transfers", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").references(() => contracts.id),
  merchantId: integer("merchant_id").references(() => merchants.id),
  transferId: text("transfer_id").notNull(), // The transfer ID from Plaid
  originatorId: text("originator_id"), // The originator ID for this transfer
  amount: doublePrecision("amount").notNull(),
  description: text("description"),
  type: text("type").notNull(), // credit or debit
  status: text("status").notNull(),
  routedToShifi: boolean("routed_to_shifi").notNull().default(false), // Whether this was routed to ShiFi fund
  facilitatorFee: doublePrecision("facilitator_fee"), // Fee collected by ShiFi
  metadata: text("metadata"), // JSON stringified additional data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertPlaidTransferSchema = createInsertSchema(plaidTransfers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PlaidTransfer = typeof plaidTransfers.$inferSelect;
export type InsertPlaidTransfer = z.infer<typeof insertPlaidTransferSchema>;
