import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  doublePrecision,
  pgEnum,
  json,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "merchant",
  "customer",
  "sales_rep",
]);
export const contractStatusEnum = pgEnum("contract_status", [
  "pending",
  "active",
  "completed",
  "declined",
  "cancelled",
]);
export const tokenizationStatusEnum = pgEnum("tokenization_status", [
  "pending",
  "processing",
  "tokenized",
  "failed",
]);
export const applicationStepEnum = pgEnum("application_step", [
  "terms",
  "kyc",
  "bank",
  "bank_pending",
  "payment",
  "signing",
  "completed",
]);
export const logLevelEnum = pgEnum("log_level", [
  "debug",
  "info",
  "warn",
  "error",
  "critical",
]);
export const logCategoryEnum = pgEnum("log_category", [
  "system",
  "user",
  "api",
  "payment",
  "security",
  "contract",
  "sms",
  "underwriting",
]);
export const logSourceEnum = pgEnum("log_source", [
  "internal",
  "twilio",
  "didit",
  "plaid",
  "thanksroger",
  "prefi",
  "stripe",
  "cfpb",
  "nlpearl",
  "signing",
  "analytics",
  "notification",
  "openai",
  "blockchain"
]);
export const verificationTypeEnum = pgEnum("verification_type", [
  "identity",
  "bank",
  "address",
  "business",
  "ownership",
]);
export const creditTierEnum = pgEnum("credit_tier", [
  "tier1",
  "tier2",
  "tier3",
  "declined",
]);
export const onboardingStatusEnum = pgEnum("onboarding_status", [
  "pending",
  "in_progress",
  "completed",
  "rejected",
]);

// Users
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  name: text("name"), // Keep for backward compatibility
  role: userRoleEnum("role").notNull().default("customer"),
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
  archived: boolean("archived").default(false), // Add this line
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
  merchantId: integer("merchant_id")
    .references(() => merchants.id)
    .notNull(),
  customerId: integer("customer_id").references(() => users.id),
  salesRepId: integer("sales_rep_id").references(() => users.id), // ID of the sales rep who created/owns this contract
  amount: doublePrecision("amount").notNull(),
  downPayment: doublePrecision("down_payment").notNull(),
  financedAmount: doublePrecision("financed_amount").notNull(),
  termMonths: integer("term_months").notNull().default(24),
  interestRate: doublePrecision("interest_rate").notNull().default(0),
  monthlyPayment: doublePrecision("monthly_payment").notNull(),
  status: contractStatusEnum("status").notNull().default("pending"),
  currentStep: applicationStepEnum("current_step").notNull().default("terms"),
  purchasedByShifi: boolean("purchased_by_shifi").notNull().default(false), // Whether contract has been purchased by ShiFi Fund
  archived: boolean("archived").default(false), // Whether this contract is archived
  archivedAt: timestamp("archived_at"), // When the contract was archived
  archivedReason: text("archived_reason"), // Reason for archiving
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  phoneNumber: text("phone_number"), // Store customer phone number directly in contract
  
  // Blockchain and tokenization fields
  tokenizationStatus: tokenizationStatusEnum("tokenization_status").default("pending"),
  tokenId: text("token_id"), // The token ID on the blockchain
  smartContractAddress: text("smart_contract_address"), // Address of the smart contract holding this token
  blockchainTransactionHash: text("blockchain_transaction_hash"), // Hash of the transaction that created the token
  blockNumber: integer("block_number"), // Block number when the token was created
  tokenizationDate: timestamp("tokenization_date"), // When the contract was tokenized
  tokenMetadata: text("token_metadata"), // JSON stringified metadata stored with the token
  tokenizationError: text("tokenization_error"), // Error message if tokenization failed
});

export const insertContractSchema = createInsertSchema(contracts).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

// Application Progress
export const applicationProgress = pgTable("application_progress", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id")
    .references(() => contracts.id)
    .notNull(),
  step: applicationStepEnum("step").notNull(),
  completed: boolean("completed").default(false),
  data: text("data"), // JSON stringified data specific to the step
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertApplicationProgressSchema = createInsertSchema(
  applicationProgress,
).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

// Logs
export const logs = pgTable("logs", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").defaultNow(),
  level: logLevelEnum("level").notNull().default("info"),
  category: logCategoryEnum("category").notNull().default("system"),
  message: text("message").notNull(),
  userId: integer("user_id").references(() => users.id),
  source: logSourceEnum("source").notNull().default("internal"),
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
export type InsertApplicationProgress = z.infer<
  typeof insertApplicationProgressSchema
>;

// Underwriting data
export const underwritingData = pgTable("underwriting_data", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
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

export const insertUnderwritingDataSchema = createInsertSchema(
  underwritingData,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Log = typeof logs.$inferSelect;
export type InsertLog = z.infer<typeof insertLogSchema>;

export type UnderwritingData = typeof underwritingData.$inferSelect;
export type InsertUnderwritingData = z.infer<
  typeof insertUnderwritingDataSchema
>;

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

export const insertPortfolioMonitoringSchema = createInsertSchema(
  portfolioMonitoring,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertComplaintsDataSchema = createInsertSchema(
  complaintsData,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type AssetReport = typeof assetReports.$inferSelect;
export type InsertAssetReport = z.infer<typeof insertAssetReportSchema>;

export type PortfolioMonitoring = typeof portfolioMonitoring.$inferSelect;
export type InsertPortfolioMonitoring = z.infer<
  typeof insertPortfolioMonitoringSchema
>;

export type ComplaintsData = typeof complaintsData.$inferSelect;
export type InsertComplaintsData = z.infer<typeof insertComplaintsDataSchema>;

// Merchant Performance
export const merchantPerformance = pgTable("merchant_performance", {
  id: serial("id").primaryKey(),
  merchantId: integer("merchant_id")
    .references(() => merchants.id)
    .notNull(),
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

export const insertMerchantPerformanceSchema = createInsertSchema(
  merchantPerformance,
).omit({
  id: true,
  createdAt: true,
});

export type MerchantPerformance = typeof merchantPerformance.$inferSelect;
export type InsertMerchantPerformance = z.infer<
  typeof insertMerchantPerformanceSchema
>;

// Plaid Platform Payment data for merchants
export const plaidMerchants = pgTable("plaid_merchants", {
  id: serial("id").primaryKey(),
  merchantId: integer("merchant_id")
    .references(() => merchants.id)
    .notNull()
    .unique(),
  plaidCustomerId: text("plaid_customer_id"), // The ID assigned by Plaid for this merchant
  clientId: text("client_id"), // The client ID provided by Plaid for this merchant
  originatorId: text("originator_id"), // The originator ID from Plaid
  onboardingStatus: onboardingStatusEnum("onboarding_status")
    .notNull()
    .default("pending"),
  onboardingUrl: text("onboarding_url"), // The URL for the merchant to complete onboarding
  questionnaireId: text("questionnaire_id"), // The ID of the onboarding questionnaire
  plaidData: text("plaid_data"), // JSON stringified Plaid merchant data
  accessToken: text("access_token"), // The Plaid access token for this merchant
  accountId: text("account_id"), // The primary bank account ID for this merchant
  defaultFundingAccount: text("default_funding_account"), // The default account for payments
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertPlaidMerchantSchema = createInsertSchema(
  plaidMerchants,
).omit({
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

export const insertPlaidTransferSchema = createInsertSchema(
  plaidTransfers,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PlaidTransfer = typeof plaidTransfers.$inferSelect;
export type InsertPlaidTransfer = z.infer<typeof insertPlaidTransferSchema>;

// Merchant Business Details
export const merchantBusinessDetails = pgTable("merchant_business_details", {
  id: serial("id").primaryKey(),
  merchantId: integer("merchant_id")
    .references(() => merchants.id)
    .notNull(),
  legalName: text("legal_name").notNull(),
  ein: text("ein").notNull(), // Employer Identification Number
  businessStructure: text("business_structure").notNull(), // LLC, Corporation, Partnership, etc.
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  websiteUrl: text("website_url"),
  industryType: text("industry_type"),
  yearEstablished: integer("year_established"),
  annualRevenue: doublePrecision("annual_revenue"),
  monthlyRevenue: doublePrecision("monthly_revenue"),
  employeeCount: integer("employee_count"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertMerchantBusinessDetailsSchema = createInsertSchema(
  merchantBusinessDetails,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type MerchantBusinessDetails =
  typeof merchantBusinessDetails.$inferSelect;
export type InsertMerchantBusinessDetails = z.infer<
  typeof insertMerchantBusinessDetailsSchema
>;

// Merchant Documents
export const merchantDocuments = pgTable("merchant_documents", {
  id: serial("id").primaryKey(),
  merchantId: integer("merchant_id")
    .references(() => merchants.id)
    .notNull(),
  type: text("type").notNull(), // business_license, tax_return, bank_statement, etc.
  filename: text("filename").notNull(),
  data: text("data").notNull(), // Base64 encoded file data or file path
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  verified: boolean("verified").default(false),
  verifiedAt: timestamp("verified_at"),
  verifiedBy: integer("verified_by").references(() => users.id),
  metadata: text("metadata"), // JSON stringified additional data
});

export const insertMerchantDocumentSchema = createInsertSchema(
  merchantDocuments,
).omit({
  id: true,
  uploadedAt: true,
  verifiedAt: true,
});

export type MerchantDocument = typeof merchantDocuments.$inferSelect;
export type InsertMerchantDocument = z.infer<
  typeof insertMerchantDocumentSchema
>;

// Notification Status and Channel Enums
export const notificationStatusEnum = pgEnum("notification_status", [
  "pending",
  "delivered",
  "failed",
  "partial_failure",
]);
export const notificationChannelEnum = pgEnum("notification_channel", [
  "email",
  "sms",
  "in_app",
  "webhook",
]);
export const notificationRecipientTypeEnum = pgEnum(
  "notification_recipient_type",
  ["merchant", "customer", "admin"],
);

// Smart Contract Template Types
export const smartContractTypeEnum = pgEnum("smart_contract_type", [
  "standard_financing",
  "zero_interest_financing",
  "merchant_specific",
  "custom"
]);

// Notifications
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  recipientId: integer("recipient_id").notNull(), // ID of the merchant, customer, or admin
  recipientType: notificationRecipientTypeEnum("recipient_type").notNull(),
  type: text("type").notNull(), // notification type code
  status: notificationStatusEnum("status").notNull().default("pending"),
  channels: text("channels").array(), // Array of channels used
  sentAt: timestamp("sent_at").defaultNow(),
  metadata: text("metadata"), // JSON stringified additional data
  updatedAt: timestamp("updated_at"),
});

// Notification Channels - tracks status of each channel for a notification
export const notificationChannels = pgTable("notification_channels", {
  id: serial("id").primaryKey(),
  notificationId: integer("notification_id")
    .references(() => notifications.id)
    .notNull(),
  channel: notificationChannelEnum("channel").notNull(),
  status: notificationStatusEnum("status").notNull().default("pending"),
  sentAt: timestamp("sent_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0),
});

// In-App Notifications - persistent notifications stored for display in the UI
export const inAppNotifications = pgTable("in_app_notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(), // ID of the user (merchant, customer, admin)
  userType: notificationRecipientTypeEnum("user_type").notNull(),
  type: text("type").notNull(), // notification type code
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  readAt: timestamp("read_at"),
  metadata: text("metadata"), // JSON stringified additional data
});

// Create schema objects for notifications
export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  sentAt: true,
  updatedAt: true,
});

export const insertNotificationChannelSchema = createInsertSchema(
  notificationChannels,
).omit({
  id: true,
  sentAt: true,
  updatedAt: true,
});

export const insertInAppNotificationSchema = createInsertSchema(
  inAppNotifications,
).omit({
  id: true,
  createdAt: true,
  readAt: true,
});

// Export types
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type NotificationChannel = typeof notificationChannels.$inferSelect;
export type InsertNotificationChannel = z.infer<
  typeof insertNotificationChannelSchema
>;

export type InAppNotification = typeof inAppNotifications.$inferSelect;
export type InsertInAppNotification = z.infer<
  typeof insertInAppNotificationSchema
>;

// Customer Satisfaction Survey
export const customerSatisfactionSurveys = pgTable("customer_satisfaction_surveys", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").notNull().references(() => contracts.id),
  customerId: integer("customer_id").notNull().references(() => users.id),
  rating: integer("rating").notNull(), // Scale 1-10
  feedback: text("feedback"),
  sentAt: timestamp("sent_at").defaultNow(),
  respondedAt: timestamp("responded_at"),
  responseSource: text("response_source"), // 'sms' or 'in_app'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCustomerSatisfactionSurveySchema = createInsertSchema(
  customerSatisfactionSurveys
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CustomerSatisfactionSurvey = typeof customerSatisfactionSurveys.$inferSelect;
export type InsertCustomerSatisfactionSurvey = z.infer<
  typeof insertCustomerSatisfactionSurveySchema
>;

// Smart Contract Templates
export const smartContractTemplates = pgTable("smart_contract_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  contractType: smartContractTypeEnum("contract_type").notNull().default("standard_financing"),
  abiJson: text("abi_json").notNull(), // ABI (Application Binary Interface) JSON
  bytecode: text("bytecode").notNull(), // Compiled contract bytecode
  sourceCode: text("source_code"), // Original Solidity source code
  version: text("version").notNull(),
  merchantId: integer("merchant_id").references(() => merchants.id), // For merchant-specific templates
  parameters: text("parameters"), // JSON of required parameters
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertSmartContractTemplateSchema = createInsertSchema(
  smartContractTemplates
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Smart Contract Deployments
export const smartContractDeployments = pgTable("smart_contract_deployments", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").references(() => smartContractTemplates.id).notNull(),
  contractAddress: text("contract_address").notNull(),
  networkId: integer("network_id").notNull(), // Which blockchain network it's deployed on
  deploymentParams: text("deployment_params"), // JSON of deployment parameters
  deployedAt: timestamp("deployed_at").defaultNow(),
  deployedBy: integer("deployed_by").references(() => users.id),
  transactionHash: text("transaction_hash").notNull(),
  status: text("status").notNull().default("active"), // active, deprecated, etc.
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertSmartContractDeploymentSchema = createInsertSchema(
  smartContractDeployments
).omit({
  id: true,
  deployedAt: true,
  createdAt: true,
  updatedAt: true,
});

export type SmartContractTemplate = typeof smartContractTemplates.$inferSelect;
export type InsertSmartContractTemplate = z.infer<typeof insertSmartContractTemplateSchema>;

export type SmartContractDeployment = typeof smartContractDeployments.$inferSelect;
export type InsertSmartContractDeployment = z.infer<typeof insertSmartContractDeploymentSchema>;

// Commission rate types enum
export const commissionRateTypeEnum = pgEnum("commission_rate_type", [
  "percentage", // Percentage of contract value
  "fixed", // Fixed amount per contract
]);

// Sales Rep Management
export const salesReps = pgTable("sales_reps", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull()
    .unique(),
  merchantId: integer("merchant_id")
    .references(() => merchants.id)
    .notNull(),
  active: boolean("active").default(true),
  title: text("title"),
  commissionRate: doublePrecision("commission_rate").default(0), // Default commission rate (percentage or fixed amount)
  commissionRateType: commissionRateTypeEnum("commission_rate_type").default("percentage"),
  maxAllowedFinanceAmount: doublePrecision("max_allowed_finance_amount"), // Maximum finance amount this rep can approve
  target: doublePrecision("target"), // Monthly or quarterly sales target
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertSalesRepSchema = createInsertSchema(
  salesReps
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Commission records for tracking sales rep commissions
export const commissions = pgTable("commissions", {
  id: serial("id").primaryKey(),
  salesRepId: integer("sales_rep_id")
    .references(() => salesReps.id)
    .notNull(),
  contractId: integer("contract_id")
    .references(() => contracts.id)
    .notNull(),
  amount: doublePrecision("amount").notNull(), // Commission amount
  rate: doublePrecision("rate").notNull(), // Rate used for this commission
  rateType: commissionRateTypeEnum("rate_type").notNull(), // Percentage or fixed
  contractAmount: doublePrecision("contract_amount").notNull(), // The contract amount this commission is based on
  status: text("status").default("pending"), // pending, paid, cancelled
  paidAt: timestamp("paid_at"),
  notes: text("notes"),
  metadata: text("metadata"), // JSON stringified additional data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertCommissionSchema = createInsertSchema(
  commissions
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Sales Rep Analytics
export const salesRepAnalytics = pgTable("sales_rep_analytics", {
  id: serial("id").primaryKey(),
  salesRepId: integer("sales_rep_id")
    .references(() => salesReps.id)
    .notNull(),
  period: text("period").notNull(), // YYYY-MM for monthly, YYYY-QQ for quarterly
  contractsCreated: integer("contracts_created").default(0),
  contractsApproved: integer("contracts_approved").default(0),
  contractsDeclined: integer("contracts_declined").default(0),
  totalAmount: doublePrecision("total_amount").default(0),
  totalCommission: doublePrecision("total_commission").default(0),
  targetAchievementPercentage: doublePrecision("target_achievement_percentage"),
  conversionRate: doublePrecision("conversion_rate"), // Percentage of created contracts that get approved
  avgContractAmount: doublePrecision("avg_contract_amount"),
  metadata: text("metadata"), // JSON stringified additional data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertSalesRepAnalyticsSchema = createInsertSchema(
  salesRepAnalytics
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SalesRep = typeof salesReps.$inferSelect;
export type InsertSalesRep = z.infer<typeof insertSalesRepSchema>;

export type Commission = typeof commissions.$inferSelect;
export type InsertCommission = z.infer<typeof insertCommissionSchema>;

export type SalesRepAnalytics = typeof salesRepAnalytics.$inferSelect;
export type InsertSalesRepAnalytics = z.infer<typeof insertSalesRepAnalyticsSchema>;
