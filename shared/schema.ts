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
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "merchant",
  "customer",
  "sales_rep",
  "investor",
]);

export const conversationStatusEnum = pgEnum("conversation_status", [
  "active",
  "resolved",
  "archived",
]);

// Verification status enum for MidDesk and other verifications
export const verificationStatusEnum = pgEnum("verification_status", [
  "not_started",
  "pending",
  "verified",
  "failed",
  "ai_pending",
  "ai_approved",
  "ai_rejected",
]);

// Support ticket related enums
export const ticketStatusEnum = pgEnum("ticket_status", [
  "new",
  "in_progress",
  "pending_merchant",
  "pending_customer",
  "resolved",
  "closed",
  "under_review", // Added for automated assignment
  "escalated", // Added for escalation tickets that require immediate attention
]);

export const ticketPriorityEnum = pgEnum("ticket_priority", [
  "low",
  "normal",
  "high",
  "urgent",
]);

export const ticketCategoryEnum = pgEnum("ticket_category", [
  "accounting",
  "customer_issue",
  "technical_issue",
  "payment_processing",
  "contract_management",
  "funding",
  "api_integration",
  "security",
  "other",
]);

// Knowledge base article types
export const kbArticleStatusEnum = pgEnum("kb_article_status", [
  "draft",
  "published",
  "archived",
]);

// SLA status enums
export const slaStatusEnum = pgEnum("sla_status", [
  "within_target",
  "at_risk",
  "breached",
]);

// Chat message type enum
export const chatMessageTypeEnum = pgEnum("chat_message_type", [
  "text",
  "system",
  "file",
  "image",
  "automated",
  "transfer",
  "join",
  "leave",
]);
export const contractStatusEnum = pgEnum("contract_status", [
  "pending",
  "active",
  "completed",
  "declined",
  "cancelled",
  "cancellation_requested",
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
  "blockchain",
  "sesameai",
  "middesk"
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

export const investorVerificationStatusEnum = pgEnum("investor_verification_status", [
  "not_started",
  "pending",
  "verified",
  "rejected",
  "under_review",
  "incomplete",
]);

export const accreditationMethodEnum = pgEnum("accreditation_method", [
  "income",
  "net_worth",
  "professional_certification",
  "entity",
]);

export const investmentOfferingTypeEnum = pgEnum("investment_offering_type", [
  "fixed_term_15_2yr",
  "fixed_term_18_4yr",
]);

export const investmentStatusEnum = pgEnum("investment_status", [
  "pending",
  "processing",
  "funded",
  "active",
  "completed",
  "cancelled",
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
  emailVerified: boolean("email_verified").default(false),
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
  
  // Cancellation fields
  cancellationRequestedAt: timestamp("cancellation_requested_at"), // When the merchant requested cancellation
  cancellationReason: text("cancellation_reason"), // Reason provided by merchant
  cancellationNotes: text("cancellation_notes"), // Additional notes for the cancellation
  cancellationApprovedAt: timestamp("cancellation_approved_at"), // When admin approved the cancellation
  cancellationApprovedBy: integer("cancellation_approved_by").references(() => users.id), // Admin user who approved
  cancellationDeniedAt: timestamp("cancellation_denied_at"), // When admin denied the cancellation
  cancellationDeniedBy: integer("cancellation_denied_by").references(() => users.id), // Admin user who denied
  cancellationDenialReason: text("cancellation_denial_reason"), // Reason for denial
  refundAmount: doublePrecision("refund_amount"), // Amount to be refunded
  refundProcessedAt: timestamp("refund_processed_at"), // When refund was processed
  fundingCycleAdjustment: doublePrecision("funding_cycle_adjustment"), // Amount to adjust from next funding cycle
  
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
  formationDate: text("formation_date"), // Date the business was formed (for MidDesk)
  phone: text("phone"), // Business phone (for MidDesk)
  middeskBusinessId: text("middesk_business_id"), // ID assigned by MidDesk for this business verification
  verificationStatus: verificationStatusEnum("verification_status").default("not_started"), // Status of the verification with MidDesk
  verificationData: text("verification_data"), // JSON stringified data from MidDesk
  
  // AI-powered verification fields
  aiVerificationStatus: text("ai_verification_status"), // AI verification status: 'pending', 'approved', 'rejected'
  aiVerificationScore: integer("ai_verification_score"), // Score from 0-100 indicating eligibility
  aiVerificationDetails: text("ai_verification_details"), // JSON stringified details of verification
  aiVerificationRecommendations: text("ai_verification_recommendations"), // JSON stringified recommendations
  aiVerificationDate: timestamp("ai_verification_date"), // When AI verification was performed
  adminReviewNotes: text("admin_review_notes"), // Notes from admin review of AI verification
  adminReviewedAt: timestamp("admin_reviewed_at"), // When admin reviewed the verification
  adminReviewedBy: integer("admin_reviewed_by").references(() => users.id), // Admin who reviewed the verification
  
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

// Contract Cancellation Status Enum
export const cancellationStatusEnum = pgEnum("cancellation_status", [
  "pending",  // Initial state when merchant requests cancellation
  "under_review", // Admin is reviewing the request
  "approved", // Cancellation approved by admin
  "denied",   // Cancellation denied by admin
  "processed", // Cancellation has been fully processed (including refunds/adjustments)
]);

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

// Conversation Status Enum is defined at the top of the file (line 23)

// Conversations - Thread of messages between admins and merchants
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  topic: text("topic").notNull(),
  subject: text("subject"), // Added subject field for backward compatibility
  contractId: integer("contract_id").references(() => contracts.id), // Optional link to a specific contract
  status: conversationStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  createdBy: integer("created_by").references(() => users.id).notNull(), // User who started the conversation
  priority: text("priority").default("normal"), // normal, high, urgent
  category: text("category").notNull(), // contract-question, payment-issue, default-notice, etc.
});

// Messages within conversations
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").references(() => conversations.id).notNull(),
  senderId: integer("sender_id").references(() => users.id).notNull(),
  senderRole: userRoleEnum("sender_role").notNull(), // Uses existing user role enum
  content: text("content").notNull(),
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow(),
  attachments: text("attachments").array(), // Array of attachment URLs or IDs
  metadata: text("metadata"), // JSON stringified additional data (e.g., flagged as important)
});

// Support ticket tables
export const supportTickets = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  ticketNumber: text("ticket_number").notNull().unique(), // Formatted like "TICKET-12345"
  merchantId: integer("merchant_id").references(() => merchants.id).notNull(),
  createdBy: integer("created_by").references(() => users.id).notNull(), // User who created the ticket
  category: ticketCategoryEnum("category").notNull(),
  subcategory: text("subcategory"), // This will be populated based on the category selection
  subject: text("subject").notNull(), // Short description/summary of the issue
  description: text("description"), // Detailed description of the issue
  status: ticketStatusEnum("status").notNull().default("new"),
  priority: ticketPriorityEnum("priority").notNull().default("normal"),
  assignedTo: integer("assigned_to").references(() => users.id), // Admin/support staff assigned to the ticket
  conversationId: integer("conversation_id").references(() => conversations.id), // Associated conversation for ongoing communication
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
  firstResponseAt: timestamp("first_response_at"), // When the ticket received its first response
  resolvedAt: timestamp("resolved_at"),
  closedAt: timestamp("closed_at"),
  slaStatus: slaStatusEnum("sla_status").default("within_target"), // SLA status tracking
  dueBy: timestamp("due_by"), // When the ticket is due by according to SLA
  tags: text("tags").array(), // Tags for categorizing tickets
  kbArticleIds: integer("kb_article_ids").array(), // Related knowledge base articles
  relatedTickets: integer("related_tickets").array(), // IDs of related tickets
  metadata: text("metadata"), // JSON stringified additional data
});

export const ticketAttachments = pgTable("ticket_attachments", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").references(() => supportTickets.id).notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  fileType: text("file_type").notNull(), // MIME type
  fileUrl: text("file_url").notNull(), // URL to the stored file
  uploadedBy: integer("uploaded_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const ticketActivityLog = pgTable("ticket_activity_log", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").references(() => supportTickets.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  actionType: text("action_type").notNull(), // created, updated, assigned, commented, resolved, closed, reopened
  actionDetails: text("action_details"), // Details about the action taken
  previousValue: text("previous_value"), // Previous value if it was an update
  newValue: text("new_value"), // New value if it was an update
  timestamp: timestamp("timestamp").defaultNow(),
  metadata: text("metadata"), // JSON stringified additional data
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastMessageAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
  readAt: true,
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

// Support ticket insert schemas
// Contract Cancellation Requests
export const contractCancellationRequests = pgTable("contract_cancellation_requests", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").references(() => contracts.id).notNull(),
  requestedBy: integer("requested_by").references(() => users.id).notNull(),
  merchantId: integer("merchant_id").references(() => merchants.id).notNull(),
  requestReason: text("request_reason").notNull(),
  additionalNotes: text("additional_notes"),
  status: cancellationStatusEnum("status").notNull().default("pending"),
  requestedAt: timestamp("requested_at").defaultNow(),
  reviewedBy: integer("reviewed_by").references(() => users.id), // Admin who reviewed the request
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  deniedBy: integer("denied_by").references(() => users.id),
  deniedAt: timestamp("denied_at"),
  denialReason: text("denial_reason"),
  refundAmount: doublePrecision("refund_amount"),
  refundProcessedAt: timestamp("refund_processed_at"),
  fundingCycleAdjustment: doublePrecision("funding_cycle_adjustment"),
  adjustmentProcessedAt: timestamp("adjustment_processed_at"),
  metadata: text("metadata"), // JSON stringified additional data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertContractCancellationRequestSchema = createInsertSchema(
  contractCancellationRequests
).omit({
  id: true,
  requestedAt: true,
  createdAt: true,
  updatedAt: true,
  reviewedAt: true,
  approvedAt: true,
  deniedAt: true,
  refundProcessedAt: true,
  adjustmentProcessedAt: true,
});

export type ContractCancellationRequest = typeof contractCancellationRequests.$inferSelect;
export type InsertContractCancellationRequest = z.infer<typeof insertContractCancellationRequestSchema>;

export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
  closedAt: true,
});

export const insertTicketAttachmentSchema = createInsertSchema(ticketAttachments).omit({
  id: true,
  createdAt: true,
});

export const insertTicketActivityLogSchema = createInsertSchema(ticketActivityLog).omit({
  id: true,
  timestamp: true,
});

// Support ticket types
export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;

export type TicketAttachment = typeof ticketAttachments.$inferSelect;
export type InsertTicketAttachment = z.infer<typeof insertTicketAttachmentSchema>;

export type TicketActivityLog = typeof ticketActivityLog.$inferSelect;
export type InsertTicketActivityLog = z.infer<typeof insertTicketActivityLogSchema>;

// Support Agent tables for intelligent routing
export const supportAgents = pgTable("support_agents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  specialties: text("specialties").array(), // Specialities like "accounting", "technical", etc.
  currentWorkload: integer("current_workload").default(0), // Number of active tickets assigned
  maxWorkload: integer("max_workload").default(10), // Maximum workload capacity
  isAvailable: boolean("is_available").default(true), // Whether agent is available for new assignments
  lastAssignedAt: timestamp("last_assigned_at"),
  isOnline: boolean("is_online").default(false), // Whether agent is currently online for chat
  lastSeenAt: timestamp("last_seen_at"), // Last time the agent was active
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
  metadata: text("metadata"), // JSON stringified additional data
});

export const supportAgentPerformance = pgTable("support_agent_performance", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => supportAgents.id).notNull(),
  period: text("period").notNull(), // "daily", "weekly", "monthly"
  date: timestamp("date").notNull(), // The date this performance record is for
  ticketsAssigned: integer("tickets_assigned").default(0),
  ticketsResolved: integer("tickets_resolved").default(0),
  averageResolutionTimeHours: doublePrecision("average_resolution_time_hours"),
  averageResponseTimeHours: doublePrecision("average_response_time_hours"),
  customerSatisfactionScore: doublePrecision("customer_satisfaction_score"),
  createdAt: timestamp("created_at").defaultNow(),
});

// SLA configuration for tickets
export const ticketSlaConfigs = pgTable("ticket_sla_configs", {
  id: serial("id").primaryKey(),
  priority: ticketPriorityEnum("priority").notNull(),
  category: ticketCategoryEnum("category"), // If null, applies to all categories
  firstResponseTimeHours: integer("first_response_time_hours").notNull(),
  resolutionTimeHours: integer("resolution_time_hours").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
  createdBy: integer("created_by").references(() => users.id),
});

// Knowledge Base Categories for organizing KB articles
export const knowledgeCategories = pgTable("knowledge_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  icon: text("icon"),
  parentId: integer("parent_id").references(() => knowledgeCategories.id),
  order: integer("order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
  metadata: text("metadata"),
});

// Knowledge Tags for tagging KB articles
export const knowledgeTags = pgTable("knowledge_tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// Knowledge Base for self-service and internal documentation
export const knowledgeBaseArticles = pgTable("knowledge_base_articles", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  content: text("content").notNull(),
  summary: text("summary"),
  categoryId: integer("category_id").references(() => knowledgeCategories.id),
  legacyCategory: ticketCategoryEnum("legacy_category"), // For backwards compatibility
  subcategory: text("subcategory"),
  status: kbArticleStatusEnum("status").notNull().default("draft"),
  authorId: integer("author_id").references(() => users.id).notNull(),
  views: integer("views").default(0),
  helpful: integer("helpful").default(0),
  notHelpful: integer("not_helpful").default(0),
  tags: text("tags").array(),
  relatedArticleIds: integer("related_article_ids").array(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
  publishedAt: timestamp("published_at"),
  searchKeywords: text("search_keywords"), // Additional keywords for search optimization
  metadata: text("metadata"), // JSON stringified additional data
});

// Article Tags for many-to-many relationship between articles and tags
export const articleTags = pgTable("article_tags", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id").references(() => knowledgeBaseArticles.id).notNull(),
  tagId: integer("tag_id").references(() => knowledgeTags.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Article Feedback for tracking user feedback on KB articles
export const articleFeedback = pgTable("article_feedback", {
  id: serial("id").primaryKey(),
  articleId: integer("article_id").references(() => knowledgeBaseArticles.id).notNull(),
  userId: integer("user_id").references(() => users.id),
  merchantId: integer("merchant_id").references(() => merchants.id),
  isHelpful: boolean("is_helpful"),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
  metadata: text("metadata"),
});

// Insert schemas for new tables
export const insertSupportAgentSchema = createInsertSchema(supportAgents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastAssignedAt: true,
});

export const insertSupportAgentPerformanceSchema = createInsertSchema(supportAgentPerformance).omit({
  id: true,
  createdAt: true,
});

export const insertTicketSlaConfigSchema = createInsertSchema(ticketSlaConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertKnowledgeCategorySchema = createInsertSchema(knowledgeCategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertKnowledgeTagSchema = createInsertSchema(knowledgeTags).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertKnowledgeBaseArticleSchema = createInsertSchema(knowledgeBaseArticles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  publishedAt: true,
  views: true,
  helpful: true,
  notHelpful: true,
});

export const insertArticleTagSchema = createInsertSchema(articleTags).omit({
  id: true,
  createdAt: true,
});

export const insertArticleFeedbackSchema = createInsertSchema(articleFeedback).omit({
  id: true,
  createdAt: true,
});

// Chat Session for real-time chat between merchants and support agents
export const chatSessions = pgTable("chat_sessions", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").references(() => supportTickets.id), // Optional link to a support ticket
  merchantId: integer("merchant_id").references(() => merchants.id).notNull(),
  agentId: integer("agent_id").references(() => supportAgents.id), // Null until assigned
  status: text("status").notNull().default("pending"), // pending, active, closed
  subject: text("subject").notNull(),
  startedAt: timestamp("started_at").defaultNow(),
  endedAt: timestamp("ended_at"),
  waitingTimeSeconds: integer("waiting_time_seconds"), // Time spent in queue before agent response
  transferredFrom: integer("transferred_from").references(() => supportAgents.id), // If chat was transferred
  transferReason: text("transfer_reason"),
  metadata: text("metadata"), // JSON stringified additional data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  priority: text("priority").default("normal"), // normal, high, urgent
  category: ticketCategoryEnum("category").notNull().default("other"),
  tags: text("tags").array(),
  satisfaction: integer("satisfaction"), // 1-5 rating provided by merchant at end of chat
  feedback: text("feedback"), // Text feedback from merchant
});

// Chat Messages within chat sessions
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => chatSessions.id).notNull(),
  senderId: integer("sender_id").references(() => users.id).notNull(),
  senderType: text("sender_type").notNull(), // "merchant" or "agent"
  senderName: text("sender_name").notNull(),
  messageType: chatMessageTypeEnum("message_type").notNull().default("text"),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  metadata: text("metadata"), // For attachments, AI actions, etc.
});

// Insert schemas for chat tables
export const insertChatSessionSchema = createInsertSchema(chatSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastMessageAt: true,
  endedAt: true,
  waitingTimeSeconds: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  timestamp: true,
  readAt: true,
});

// Support agent types
export type SupportAgent = typeof supportAgents.$inferSelect;
export type InsertSupportAgent = z.infer<typeof insertSupportAgentSchema>;

export type SupportAgentPerformance = typeof supportAgentPerformance.$inferSelect;
export type InsertSupportAgentPerformance = z.infer<typeof insertSupportAgentPerformanceSchema>;

export type TicketSlaConfig = typeof ticketSlaConfigs.$inferSelect;
export type InsertTicketSlaConfig = z.infer<typeof insertTicketSlaConfigSchema>;

// Knowledge base types
export type KnowledgeCategory = typeof knowledgeCategories.$inferSelect;
export type InsertKnowledgeCategory = z.infer<typeof insertKnowledgeCategorySchema>;

export type KnowledgeTag = typeof knowledgeTags.$inferSelect;
export type InsertKnowledgeTag = z.infer<typeof insertKnowledgeTagSchema>;

export type KnowledgeBaseArticle = typeof knowledgeBaseArticles.$inferSelect;
export type InsertKnowledgeBaseArticle = z.infer<typeof insertKnowledgeBaseArticleSchema>;

export type ArticleTag = typeof articleTags.$inferSelect;
export type InsertArticleTag = z.infer<typeof insertArticleTagSchema>;

export type ArticleFeedback = typeof articleFeedback.$inferSelect;
export type InsertArticleFeedback = z.infer<typeof insertArticleFeedbackSchema>;

// Email verification tokens
export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
});

export const insertEmailVerificationTokenSchema = createInsertSchema(emailVerificationTokens).omit({
  id: true,
  usedAt: true,
});

// Password reset tokens
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  usedAt: true,
});

// Chat types
export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;

// Email and password reset token types
export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
export type InsertEmailVerificationToken = z.infer<typeof insertEmailVerificationTokenSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;

// One-Time Password (OTP) for customer authentication
export const oneTimePasswords = pgTable("one_time_passwords", {
  id: serial("id").primaryKey(),
  phone: text("phone").notNull(), // The phone number the OTP was sent to
  email: text("email"), // Optional email for tracking
  otp: text("otp").notNull(), // The actual OTP code
  purpose: text("purpose").notNull().default("authentication"), // The purpose of this OTP (authentication, verification, etc.)
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(), // When this OTP expires (typically 10-15 minutes)
  usedAt: timestamp("used_at"), // When the OTP was used (null if unused)
  attempts: integer("attempts").default(0), // Number of failed attempts
  verified: boolean("verified").default(false), // Whether this OTP was successfully verified
  ipAddress: text("ip_address"), // IP address that requested this OTP
  userAgent: text("user_agent"), // User agent that requested this OTP
});

export const insertOneTimePasswordSchema = createInsertSchema(oneTimePasswords).omit({
  id: true,
  usedAt: true,
  verified: true,
  attempts: true,
});

export type OneTimePassword = typeof oneTimePasswords.$inferSelect;
export type InsertOneTimePassword = z.infer<typeof insertOneTimePasswordSchema>;

// Investor Profiles
export const investorProfiles = pgTable("investor_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull()
    .unique(),
  accreditationStatus: boolean("accreditation_status"),
  verificationStatus: investorVerificationStatusEnum("verification_status").notNull().default("pending"),
  accreditationMethod: accreditationMethodEnum("accreditation_method"),
  annualIncome: doublePrecision("annual_income"),
  netWorth: doublePrecision("net_worth"),
  documentVerificationCompleted: boolean("document_verification_completed").default(false),
  maxInvestmentLimit: doublePrecision("max_investment_limit"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
  kycCompleted: boolean("kyc_completed").default(false),
  kycPassed: boolean("kyc_passed").default(false),
  investmentExperience: text("investment_experience"),
  riskTolerance: text("risk_tolerance"),
  investmentGoals: text("investment_goals"),
  taxIdNumber: text("tax_id_number"),
  verificationSessionId: text("verification_session_id"),
  
  // Identity verification fields
  dateOfBirth: timestamp("date_of_birth"),
  maritalStatus: text("marital_status"),
  citizenshipStatus: text("citizenship_status"),
  primaryResidenceValue: doublePrecision("primary_residence_value"),
  
  // Professional certification data
  professionalLicenseType: text("professional_license_type"), // e.g., "Series 7", "Series 65", "Series 82"
  professionalLicenseNumber: text("professional_license_number"),
  professionalLicenseVerified: boolean("professional_license_verified").default(false),
  
  // Income verification
  incomeVerified: boolean("income_verified").default(false),
  incomeVerificationMethod: text("income_verification_method"), // "tax_documents", "cpa_letter", etc.
  jointIncome: boolean("joint_income").default(false), // Whether income includes spouse
  currentYearIncomeExpectation: doublePrecision("current_year_income_expectation"),
  
  // Net worth verification
  netWorthVerified: boolean("net_worth_verified").default(false),
  netWorthVerificationMethod: text("net_worth_verification_method"), // "asset_documents", "cpa_letter", etc.
  
  // Review information
  reviewedBy: integer("reviewed_by").references(() => users.id), // Admin who reviewed the verification
  reviewedAt: timestamp("reviewed_at"),
  adminNotes: text("admin_notes"), // Notes from the admin reviewer
  rejectionReason: text("rejection_reason"),
  
  // Verification expiration
  verificationExpiresAt: timestamp("verification_expires_at"), // When verification expires
  lastReverificationRequestDate: timestamp("last_reverification_request_date"), // When reverification was requested
});

export const insertInvestorProfileSchema = createInsertSchema(
  investorProfiles
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Investment Offerings
export const investmentOfferings = pgTable("investment_offerings", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  type: investmentOfferingTypeEnum("type").notNull(),
  interestRate: doublePrecision("interest_rate").notNull(),
  termMonths: integer("term_months").notNull(),
  minimumInvestment: doublePrecision("minimum_investment").notNull().default(10000),
  deferredInterestMonths: integer("deferred_interest_months"),
  isActive: boolean("is_active").default(true),
  totalRaised: doublePrecision("total_raised").default(0),
  totalTarget: doublePrecision("total_target"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertInvestmentOfferingSchema = createInsertSchema(
  investmentOfferings
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Investments (when an investor purchases an offering)
export const investments = pgTable("investments", {
  id: serial("id").primaryKey(),
  investorId: integer("investor_id")
    .references(() => investorProfiles.id)
    .notNull(),
  offeringId: integer("offering_id")
    .references(() => investmentOfferings.id)
    .notNull(),
  amount: doublePrecision("amount").notNull(),
  status: investmentStatusEnum("status").notNull().default("pending"),
  agreementNumber: text("agreement_number").notNull().unique(),
  agreementDocumentUrl: text("agreement_document_url"),
  signedAgreementUrl: text("signed_agreement_url"),
  signedAt: timestamp("signed_at"),
  fundedAt: timestamp("funded_at"),
  fundingSource: text("funding_source"),
  plaidTransferId: text("plaid_transfer_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
  cancelReason: text("cancel_reason"),
  updatedAt: timestamp("updated_at"),
});

export const insertInvestmentSchema = createInsertSchema(
  investments
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  cancelledAt: true,
});

// Document Library (for investor data room)
export const documentLibrary = pgTable("document_library", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull(), // financial, legal, marketing, etc.
  fileUrl: text("file_url").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(), // pdf, docx, etc.
  fileSize: integer("file_size").notNull(),
  requiresNda: boolean("requires_nda").default(true),
  isPublic: boolean("is_public").default(false),
  uploadedBy: integer("uploaded_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertDocumentLibrarySchema = createInsertSchema(
  documentLibrary
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Export types for investor portal
export type InvestorProfile = typeof investorProfiles.$inferSelect;
export type InsertInvestorProfile = z.infer<typeof insertInvestorProfileSchema>;

export type InvestmentOffering = typeof investmentOfferings.$inferSelect;
export type InsertInvestmentOffering = z.infer<typeof insertInvestmentOfferingSchema>;

export type Investment = typeof investments.$inferSelect;
export type InsertInvestment = z.infer<typeof insertInvestmentSchema>;

export type DocumentLibrary = typeof documentLibrary.$inferSelect;
export type InsertDocumentLibrary = z.infer<typeof insertDocumentLibrarySchema>;

// Document type enum for investor verification
export const investorDocumentTypeEnum = pgEnum("investor_document_type", [
  "tax_w2",
  "tax_1040",
  "tax_1099",
  "bank_statement",
  "investment_statement",
  "cpa_letter",
  "attorney_letter",
  "government_id",
  "professional_license",
  "financial_statement",
  "proof_of_address",
  "other"
]);

// Investor verification documents
export const investorVerificationDocuments = pgTable("investor_verification_documents", {
  id: serial("id").primaryKey(),
  investorId: integer("investor_id")
    .references(() => investorProfiles.id)
    .notNull(),
  documentType: investorDocumentTypeEnum("document_type").notNull(),
  fileUrl: text("file_url").notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(), // pdf, jpg, png, etc.
  fileSize: integer("file_size").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  verificationPurpose: text("verification_purpose").notNull(), // "income", "net_worth", "identity", etc.
  year: integer("year"), // For tax documents
  verified: boolean("verified").default(false),
  verifiedAt: timestamp("verified_at"),
  verifiedBy: integer("verified_by").references(() => users.id),
  rejectionReason: text("rejection_reason"),
  adminNotes: text("admin_notes"),
  expiresAt: timestamp("expires_at"), // When document expires
  metadata: text("metadata"), // JSON stringified metadata
  ocrData: text("ocr_data"), // JSON stringified data extracted via OCR
});

export const insertInvestorVerificationDocumentSchema = createInsertSchema(
  investorVerificationDocuments
).omit({
  id: true,
  uploadedAt: true,
  verifiedAt: true,
});

export type InvestorVerificationDocument = typeof investorVerificationDocuments.$inferSelect;
export type InsertInvestorVerificationDocument = z.infer<typeof insertInvestorVerificationDocumentSchema>;

// Verification progress steps enum
export const verificationStepEnum = pgEnum("verification_step", [
  "identity",
  "income",
  "net_worth",
  "professional_certification",
  "questionnaire",
  "agreement",
  "review",
]);

// Investor verification progress
export const investorVerificationProgress = pgTable("investor_verification_progress", {
  id: serial("id").primaryKey(),
  investorId: integer("investor_id")
    .references(() => investorProfiles.id)
    .notNull(),
  step: verificationStepEnum("step").notNull(),
  completed: boolean("completed").default(false),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  data: text("data"), // JSON stringified data specific to the step
  adminReviewRequired: boolean("admin_review_required").default(false),
  adminReviewed: boolean("admin_reviewed").default(false),
  adminReviewedAt: timestamp("admin_reviewed_at"),
  adminReviewedBy: integer("admin_reviewed_by").references(() => users.id),
  adminNotes: text("admin_notes"),
});

export const insertInvestorVerificationProgressSchema = createInsertSchema(
  investorVerificationProgress
).omit({
  id: true,
  startedAt: true,
  completedAt: true,
  adminReviewedAt: true,
});

export type InvestorVerificationProgress = typeof investorVerificationProgress.$inferSelect;
export type InsertInvestorVerificationProgress = z.infer<typeof insertInvestorVerificationProgressSchema>;

// Third-party verification status enum
export const thirdPartyVerificationStatusEnum = pgEnum("third_party_verification_status", [
  "pending",
  "sent",
  "viewed",
  "completed",
  "rejected",
  "expired",
]);

// Third-party verification requests (for CPA/attorney verification)
export const thirdPartyVerificationRequests = pgTable("third_party_verification_requests", {
  id: serial("id").primaryKey(),
  investorId: integer("investor_id")
    .references(() => investorProfiles.id)
    .notNull(),
  verifierEmail: text("verifier_email").notNull(),
  verifierName: text("verifier_name"),
  verifierType: text("verifier_type").notNull(), // "cpa", "attorney", etc.
  verificationPurpose: text("verification_purpose").notNull(), // "income", "net_worth", etc.
  status: thirdPartyVerificationStatusEnum("status").notNull().default("pending"),
  requestToken: text("request_token").notNull().unique(), // Unique token for accessing verification form
  message: text("message"), // Message to verifier
  requestedAt: timestamp("requested_at").defaultNow(),
  sentAt: timestamp("sent_at"),
  viewedAt: timestamp("viewed_at"),
  completedAt: timestamp("completed_at"),
  reminderSentAt: timestamp("reminder_sent_at"),
  expiresAt: timestamp("expires_at"), // When the verification request expires
  verifierResponse: text("verifier_response"), // Response from verifier
  verifierNotes: text("verifier_notes"), // Additional notes from verifier
  documentUrl: text("document_url"), // URL to document provided by verifier
  adminReviewed: boolean("admin_reviewed").default(false),
  adminReviewedAt: timestamp("admin_reviewed_at"),
  adminReviewedBy: integer("admin_reviewed_by").references(() => users.id),
  adminNotes: text("admin_notes"),
});

export const insertThirdPartyVerificationRequestSchema = createInsertSchema(
  thirdPartyVerificationRequests
).omit({
  id: true,
  requestedAt: true,
  sentAt: true,
  viewedAt: true,
  completedAt: true,
  adminReviewedAt: true,
});

export type ThirdPartyVerificationRequest = typeof thirdPartyVerificationRequests.$inferSelect;
export type InsertThirdPartyVerificationRequest = z.infer<typeof insertThirdPartyVerificationRequestSchema>;
