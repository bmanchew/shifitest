import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  doublePrecision,
  json,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { applicationStepEnum, businessStructureEnum, verificationStatusEnum } from "./enums";
import { users } from "./user.schema";

// Merchants table
export const merchants = pgTable("merchants", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  email: text("email").notNull(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  contactName: text("contact_name").notNull(),
  address: text("address"),
  active: boolean("active").default(true),
  archived: boolean("archived").default(false),
  // Legal and program information
  terms_of_service_url: text("terms_of_service_url"),
  privacy_policy_url: text("privacy_policy_url"),
  default_program_name: text("default_program_name"),
  default_program_duration: integer("default_program_duration"),
  // Funding provider settings
  shifi_funding_enabled: boolean("shifi_funding_enabled").default(true),
  covered_care_funding_enabled: boolean("covered_care_funding_enabled").default(false),
  funding_settings: json("funding_settings"), // Additional funding provider-specific settings
});

// Merchant Programs
export const merchantPrograms = pgTable("merchant_programs", {
  id: serial("id").primaryKey(),
  merchantId: integer("merchant_id").references(() => merchants.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  durationMonths: integer("duration_months").notNull(),
  active: boolean("active").default(true),
  is_default: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// Merchant business details
export const merchantBusinessDetails = pgTable("merchant_business_details", {
  id: serial("id").primaryKey(),
  merchantId: integer("merchant_id")
    .notNull()
    .references(() => merchants.id),
  legalName: text("legal_name").notNull(),
  businessStructure: businessStructureEnum("business_structure").notNull(),
  ein: text("ein"),
  addressLine1: text("address_line1").notNull(),
  addressLine2: text("address_line2"),
  city: text("city").notNull(),
  state: text("state").notNull(),
  zipCode: text("zip_code").notNull(),
  websiteUrl: text("website_url"),
  phone: text("phone"),
  formationDate: text("formation_date"),
  yearEstablished: integer("year_established"),
  annualRevenue: doublePrecision("annual_revenue"),
  monthlyRevenue: doublePrecision("monthly_revenue"),
  employeeCount: integer("employee_count"),
  industryType: text("industry_type"),
  middeskBusinessId: text("middesk_business_id"),
  verificationStatus: verificationStatusEnum("verification_status"),
  verificationData: text("verification_data"),
  aiVerificationScore: integer("ai_verification_score"),
  aiVerificationStatus: text("ai_verification_status"),
  aiVerificationDetails: text("ai_verification_details"),
  aiVerificationRecommendations: text("ai_verification_recommendations"),
  aiVerificationDate: timestamp("ai_verification_date"),
  adminReviewedBy: integer("admin_reviewed_by"),
  adminReviewedAt: timestamp("admin_reviewed_at"),
  adminReviewNotes: text("admin_review_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// Merchant documents
export const merchantDocuments = pgTable("merchant_documents", {
  id: serial("id").primaryKey(),
  merchantId: integer("merchant_id")
    .notNull()
    .references(() => merchants.id),
  documentType: text("document_type").notNull(),
  documentName: text("document_name").notNull(),
  documentPath: text("document_path").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
  verified: boolean("verified").default(false),
  verifiedAt: timestamp("verified_at"),
  verifiedBy: integer("verified_by").references(() => users.id),
  description: text("description"),
  metadata: json("metadata"),
});

// Merchant verifications
export const merchantVerifications = pgTable("merchant_verifications", {
  id: serial("id").primaryKey(),
  merchantId: integer("merchant_id")
    .notNull()
    .references(() => merchants.id),
  verificationType: text("verification_type").notNull(),
  status: verificationStatusEnum("status").notNull().default("not_started"),
  externalId: text("external_id"),
  externalReference: text("external_reference"),
  result: json("result"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
  completedAt: timestamp("completed_at"),
  failureReason: text("failure_reason"),
  attemptCount: integer("attempt_count").default(0),
  metadata: json("metadata"),
});

// Application progress tracking
export const applicationProgress = pgTable("application_progress", {
  id: serial("id").primaryKey(),
  merchantId: integer("merchant_id")
    .notNull()
    .references(() => merchants.id),
  step: applicationStepEnum("step").notNull(),
  completed: boolean("completed").default(false),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  metadata: json("metadata"),
});

// Merchant performance metrics
export const merchantPerformance = pgTable("merchant_performance", {
  id: serial("id").primaryKey(),
  merchantId: integer("merchant_id")
    .notNull()
    .references(() => merchants.id),
  period: text("period").notNull(), // e.g., "2023-01", "2023-Q1"
  revenue: doublePrecision("revenue"),
  expenses: doublePrecision("expenses"),
  profit: doublePrecision("profit"),
  transactionCount: integer("transaction_count"),
  averageTransactionValue: doublePrecision("average_transaction_value"),
  customerCount: integer("customer_count"),
  returningCustomerRate: doublePrecision("returning_customer_rate"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
  metadata: json("metadata"),
});

// Plaid integration for merchants
export const plaidMerchants = pgTable("plaid_merchants", {
  id: serial("id").primaryKey(),
  merchantId: integer("merchant_id")
    .notNull()
    .references(() => merchants.id),
  plaidItemId: text("plaid_item_id").notNull(),
  accessToken: text("access_token").notNull(),
  status: text("status").notNull().default("active"),
  institutionId: text("institution_id"),
  institutionName: text("institution_name"),
  accountIds: text("account_ids").array(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
  lastSyncAt: timestamp("last_sync_at"),
  consentExpiresAt: timestamp("consent_expires_at"),
  metadata: json("metadata"),
});

// Plaid transfers
export const plaidTransfers = pgTable("plaid_transfers", {
  id: serial("id").primaryKey(),
  merchantId: integer("merchant_id")
    .notNull()
    .references(() => merchants.id),
  transferId: text("transfer_id").notNull(),
  amount: doublePrecision("amount").notNull(),
  currency: text("currency").notNull().default("USD"),
  status: text("status").notNull(),
  plaidAccountId: text("plaid_account_id").notNull(),
  direction: text("direction").notNull(), // "credit" or "debit"
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
  metadata: json("metadata"),
});

// Insert schema for merchants
export const insertMerchantSchema = createInsertSchema(merchants).omit({
  id: true,
  createdAt: true,
  funding_settings: true,
});

// Select type for merchants
export type Merchant = typeof merchants.$inferSelect;

// Insert type for merchants
export type InsertMerchant = z.infer<typeof insertMerchantSchema>;

// Insert schema for merchant business details
export const insertMerchantBusinessDetailsSchema = createInsertSchema(
  merchantBusinessDetails
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Select type for merchant business details
export type MerchantBusinessDetail = typeof merchantBusinessDetails.$inferSelect;

// Insert type for merchant business details
export type InsertMerchantBusinessDetail = z.infer<
  typeof insertMerchantBusinessDetailsSchema
>;

// Insert schema for merchant documents
export const insertMerchantDocumentSchema = createInsertSchema(
  merchantDocuments
).omit({
  id: true,
  uploadedAt: true,
  verifiedAt: true,
});

// Select type for merchant documents
export type MerchantDocument = typeof merchantDocuments.$inferSelect;

// Insert type for merchant documents
export type InsertMerchantDocument = z.infer<
  typeof insertMerchantDocumentSchema
>;

// Insert schema for merchant verifications
export const insertMerchantVerificationSchema = createInsertSchema(
  merchantVerifications
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  attemptCount: true,
});

// Select type for merchant verifications
export type MerchantVerification = typeof merchantVerifications.$inferSelect;

// Insert type for merchant verifications
export type InsertMerchantVerification = z.infer<
  typeof insertMerchantVerificationSchema
>;

// Insert schema for merchant programs
export const insertMerchantProgramSchema = createInsertSchema(
  merchantPrograms
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Select type for merchant programs
export type MerchantProgram = typeof merchantPrograms.$inferSelect;

// Insert type for merchant programs
export type InsertMerchantProgram = z.infer<
  typeof insertMerchantProgramSchema
>;

// Insert schema for application progress
export const insertApplicationProgressSchema = createInsertSchema(
  applicationProgress
).omit({
  id: true,
  startedAt: true,
  completedAt: true,
});

// Select type for application progress
export type ApplicationProgress = typeof applicationProgress.$inferSelect;

// Insert type for application progress
export type InsertApplicationProgress = z.infer<
  typeof insertApplicationProgressSchema
>;

// Insert schema for merchant performance
export const insertMerchantPerformanceSchema = createInsertSchema(
  merchantPerformance
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Select type for merchant performance
export type MerchantPerformance = typeof merchantPerformance.$inferSelect;

// Insert type for merchant performance
export type InsertMerchantPerformance = z.infer<
  typeof insertMerchantPerformanceSchema
>;

// Insert schema for plaid merchants
export const insertPlaidMerchantSchema = createInsertSchema(
  plaidMerchants
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastSyncAt: true,
});

// Select type for plaid merchants
export type PlaidMerchant = typeof plaidMerchants.$inferSelect;

// Insert type for plaid merchants
export type InsertPlaidMerchant = z.infer<typeof insertPlaidMerchantSchema>;

// Insert schema for plaid transfers
export const insertPlaidTransferSchema = createInsertSchema(
  plaidTransfers
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Select type for plaid transfers
export type PlaidTransfer = typeof plaidTransfers.$inferSelect;

// Insert type for plaid transfers
export type InsertPlaidTransfer = z.infer<typeof insertPlaidTransferSchema>;