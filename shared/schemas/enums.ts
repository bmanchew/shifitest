import { pgEnum } from "drizzle-orm/pg-core";

// User related enums
export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "merchant",
  "customer",
  "sales_rep",
  "investor",
]);

// Conversation related enums
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
]);

// Support ticket related enums
export const ticketStatusEnum = pgEnum("ticket_status", [
  "new",
  "in_progress",
  "pending_merchant",
  "pending_customer",
  "escalated",
  "resolved",
  "closed",
]);

export const ticketPriorityEnum = pgEnum("ticket_priority", [
  "low",
  "normal",
  "high",
  "urgent",
]);

export const ticketTypeEnum = pgEnum("ticket_type", [
  "technical",
  "billing",
  "account",
  "compliance",
  "other",
]);

// Contract related enums
export const contractTypeEnum = pgEnum("contract_type", [
  "standard_12mo",
  "extended_24mo",
  "premium_36mo",
  "custom",
]);

export const contractStatusEnum = pgEnum("contract_status", [
  "draft",
  "pending_approval",
  "approved",
  "active",
  "completed",
  "cancelled",
  "suspended",
]);

// Application progress enums
export const applicationStepEnum = pgEnum("application_step", [
  "payment",
  "completed",
  "terms",
  "kyc",
  "bank",
  "bank_pending",
  "signing",
]);

// Log category and source enums
export const logCategoryEnum = pgEnum("log_category", [
  "security",
  "system",
  "api",
  "user",
  "payment",
  "blockchain",
  "investor",
  "plaid",
  "sms",
  "email",
  "underwriting",
  "didit",
  "notification",
  "contract",
]);

export const logSourceEnum = pgEnum("log_source", [
  "internal",
  "api",
  "user",
  "merchant",
  "customer",
  "sales_rep",
  "admin",
  "investor",
  "openai",
  "blockchain",
  "contract",
  "notification",
  "plaid",
  "twilio",
  "stripe",
  "didit",
  "middesk",
  "nlpearl",
  "signing",
  "thanksroger",
  "prefi",
  "email",
  "sms",
]);

// Message enums
export const messageChannelEnum = pgEnum("message_channel", [
  "email",
  "sms",
  "push",
  "in_app",
]);

export const messageStatusEnum = pgEnum("message_status", [
  "pending",
  "delivered",
  "failed",
  "read",
]);

// Notification enums
export const notificationStatusEnum = pgEnum("notification_status", [
  "pending",
  "delivered",
  "failed",
  "partial_failure",
]);

// Investor verification enums
export const investorAccreditationStatusEnum = pgEnum(
  "investor_accreditation_status",
  ["pending", "approved", "rejected", "expired", "revoked"]
);

export const investorVerificationStatusEnum = pgEnum(
  "investor_verification_status",
  ["not_started", "pending", "verified", "rejected", "under_review", "incomplete"]
);

// Investment offering enums
export const investmentOfferingTypeEnum = pgEnum("investment_offering_type", [
  "fixed_term_15_2yr",
  "fixed_term_18_4yr",
]);

// Investment status enums
export const investmentStatusEnum = pgEnum("investment_status", [
  "pending",
  "active",
  "completed",
  "cancelled",
  "processing",
  "funded",
]);

// Document related enums
export const documentTypeEnum = pgEnum("document_type", [
  "contract",
  "terms",
  "invoice",
  "receipt",
  "statement",
  "id_verification",
  "bank_statement",
  "tax_return",
  "financial_statement",
  "certificate",
  "other",
]);

// Document status enums
export const documentStatusEnum = pgEnum("document_status", [
  "pending_upload",
  "uploaded",
  "verified",
  "rejected",
  "expired",
]);

// Business structure enum
export const businessStructureEnum = pgEnum("business_structure", [
  "llc",
  "c_corp",
  "s_corp",
  "partnership",
  "sole_proprietorship",
  "non_profit",
  "other",
]);

// Verification document enums
export const verificationDocumentTypeEnum = pgEnum("verification_document_type", [
  "id_document",
  "proof_of_address",
  "bank_statement",
  "tax_return",
  "investment_account_statement",
  "certificate",
  "income_proof",
  "net_worth_proof",
  "other",
]);

// Cancellation related enums
export const cancellationStatusEnum = pgEnum("cancellation_status", [
  "pending",
  "under_review",
  "approved",
  "denied",
  "processed",
]);

// One-time password types
export const otpTypeEnum = pgEnum("otp_type", [
  "login",
  "verification",
  "password_reset",
  "transaction",
]);

// Blockchain related enums
export const blockchainTransactionTypeEnum = pgEnum("blockchain_transaction_type", [
  "token_creation",
  "token_transfer",
  "smart_contract_deployment",
  "smart_contract_execution",
]);

export const blockchainTransactionStatusEnum = pgEnum("blockchain_transaction_status", [
  "pending",
  "confirmed",
  "failed",
  "rejected",
]);

// Third-party verification types
export const thirdPartyVerificationTypeEnum = pgEnum("third_party_verification_type", [
  "identity",
  "address",
  "income",
  "employment",
  "assets",
  "accreditation",
]);

// Third-party verification status
export const thirdPartyVerificationStatusEnum = pgEnum("third_party_verification_status", [
  "pending",
  "in_progress",
  "completed",
  "failed",
  "cancelled",
]);

// Commission rate type enum
export const commissionRateTypeEnum = pgEnum("commission_rate_type", [
  "percentage",
  "fixed",
]);

// Smart contract type enum
export const smartContractTypeEnum = pgEnum("smart_contract_type", [
  "standard_financing",
  "investment_offering",
  "payment_distribution",
  "custom",
]);

// Notification channel enum
export const notificationChannelEnum = pgEnum("notification_channel", [
  "email",
  "sms",
  "push",
  "in_app",
]);

// Notification recipient type enum
export const notificationRecipientTypeEnum = pgEnum("notification_recipient_type", [
  "merchant",
  "customer",
  "investor",
  "admin",
  "sales_rep",
]);