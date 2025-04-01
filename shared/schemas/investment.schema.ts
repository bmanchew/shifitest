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
import {
  documentStatusEnum,
  documentTypeEnum,
  investmentOfferingTypeEnum,
  investmentStatusEnum,
  investorAccreditationStatusEnum,
  investorVerificationStatusEnum,
  thirdPartyVerificationStatusEnum,
  thirdPartyVerificationTypeEnum,
  verificationDocumentTypeEnum,
} from "./enums";
import { users } from "./user.schema";

// Investor profiles
export const investorProfiles = pgTable("investor_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  accreditationStatus: boolean("accreditation_status"),
  verificationStatus: investorVerificationStatusEnum("verification_status")
    .notNull()
    .default("not_started"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email"),
  phone: text("phone"),
  dateOfBirth: timestamp("date_of_birth"),
  ssn: text("ssn"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  country: text("country").default("US"),
  employmentStatus: text("employment_status"),
  employer: text("employer"),
  occupation: text("occupation"),
  annualIncome: doublePrecision("annual_income"),
  netWorth: doublePrecision("net_worth"),
  investmentObjectives: text("investment_objectives"),
  riskTolerance: text("risk_tolerance"),
  investmentExperience: text("investment_experience"),
  sourceOfFunds: text("source_of_funds"),
  taxId: text("tax_id"),
  accreditationMethod: text("accreditation_method"),
  accreditationDate: timestamp("accreditation_date"),
  accreditationExpiryDate: timestamp("accreditation_expiry_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
  lastVerificationDate: timestamp("last_verification_date"),
  lastReverificationRequestDate: timestamp("last_reverification_request_date"),
});

// Investment offerings
export const investmentOfferings = pgTable("investment_offerings", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  type: investmentOfferingTypeEnum("type").notNull(),
  interestRate: doublePrecision("interest_rate").notNull(),
  termMonths: integer("term_months").notNull(),
  minimumInvestment: doublePrecision("minimum_investment").notNull(),
  maximumInvestment: doublePrecision("maximum_investment"),
  totalFundingTarget: doublePrecision("total_funding_target"),
  currentFunding: doublePrecision("current_funding").default(0),
  deferredInterestMonths: integer("deferred_interest_months").default(0),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// Investments
export const investments = pgTable("investments", {
  id: serial("id").primaryKey(),
  investorId: integer("investor_id")
    .notNull()
    .references(() => investorProfiles.id),
  offeringId: integer("offering_id")
    .notNull()
    .references(() => investmentOfferings.id),
  amount: doublePrecision("amount").notNull(),
  interestRate: doublePrecision("interest_rate"),
  termMonths: integer("term_months"),
  startDate: timestamp("start_date"),
  maturityDate: timestamp("maturity_date"),
  status: investmentStatusEnum("status").notNull().default("pending"),
  agreementNumber: text("agreement_number").notNull(),
  agreementSigned: boolean("agreement_signed").default(false),
  agreementSignedDate: timestamp("agreement_signed_date"),
  fundedDate: timestamp("funded_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
  paymentMethod: text("payment_method"),
  paymentDetails: json("payment_details"),
  cancellationReason: text("cancellation_reason"),
  cancelledDate: timestamp("cancelled_date"),
});

// Document library
export const documentLibrary = pgTable("document_library", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  documentType: documentTypeEnum("document_type").notNull(),
  category: text("category"),
  version: text("version").notNull().default("1.0"),
  filePath: text("file_path").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size"),
  uploadedBy: integer("uploaded_by").references(() => users.id),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
  status: documentStatusEnum("status").notNull().default("uploaded"),
  isTemplate: boolean("is_template").default(false),
  templateVariables: json("template_variables"),
  metadata: json("metadata"),
  tags: text("tags").array(),
  accessLevel: text("access_level").notNull().default("private"),
  expiryDate: timestamp("expiry_date"),
  archivedAt: timestamp("archived_at"),
  archivedBy: integer("archived_by").references(() => users.id),
  archivedReason: text("archived_reason"),
});

// Investor verification documents
export const investorVerificationDocuments = pgTable("investor_verification_documents", {
  id: serial("id").primaryKey(),
  investorId: integer("investor_id")
    .notNull()
    .references(() => investorProfiles.id),
  documentType: verificationDocumentTypeEnum("document_type").notNull(),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  verificationStatus: text("verification_status").notNull().default("pending"),
  verifiedAt: timestamp("verified_at"),
  verifiedBy: integer("verified_by").references(() => users.id),
  rejectionReason: text("rejection_reason"),
  expiryDate: timestamp("expiry_date"),
  metadata: json("metadata"),
  documentCategory: text("document_category"),
  documentPurpose: text("document_purpose").notNull(),
  issueDate: timestamp("issue_date"),
  issuingAuthority: text("issuing_authority"),
  documentNumber: text("document_number"),
  notes: text("notes"),
});

// Investor verification progress
export const investorVerificationProgress = pgTable("investor_verification_progress", {
  id: serial("id").primaryKey(),
  investorId: integer("investor_id")
    .notNull()
    .references(() => investorProfiles.id),
  step: text("step").notNull(),
  status: text("status").notNull().default("pending"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  lastUpdatedAt: timestamp("last_updated_at"),
  notes: text("notes"),
  metadata: json("metadata"),
  reviewer: integer("reviewer").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
});

// Third-party verification requests
export const thirdPartyVerificationRequests = pgTable("third_party_verification_requests", {
  id: serial("id").primaryKey(),
  investorId: integer("investor_id")
    .notNull()
    .references(() => investorProfiles.id),
  verificationType: thirdPartyVerificationTypeEnum("verification_type").notNull(),
  provider: text("provider").notNull(),
  externalRequestId: text("external_request_id"),
  requestData: json("request_data"),
  status: thirdPartyVerificationStatusEnum("status").notNull().default("pending"),
  result: json("result"),
  requestedAt: timestamp("requested_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  expiresAt: timestamp("expires_at"),
  metadata: json("metadata"),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0),
  lastRetryAt: timestamp("last_retry_at"),
});

// Insert schema for investor profiles
export const insertInvestorProfileSchema = createInsertSchema(
  investorProfiles
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  accreditationDate: true,
  lastVerificationDate: true,
  lastReverificationRequestDate: true,
});

// Select type for investor profiles
export type InvestorProfile = typeof investorProfiles.$inferSelect;

// Insert type for investor profiles
export type InsertInvestorProfile = z.infer<typeof insertInvestorProfileSchema>;

// Insert schema for investment offerings
export const insertInvestmentOfferingSchema = createInsertSchema(
  investmentOfferings
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  currentFunding: true,
});

// Select type for investment offerings
export type InvestmentOffering = typeof investmentOfferings.$inferSelect;

// Insert type for investment offerings
export type InsertInvestmentOffering = z.infer<
  typeof insertInvestmentOfferingSchema
>;

// Insert schema for investments
export const insertInvestmentSchema = createInsertSchema(investments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  agreementSignedDate: true,
  fundedDate: true,
  cancelledDate: true,
});

// Select type for investments
export type Investment = typeof investments.$inferSelect;

// Insert type for investments
export type InsertInvestment = z.infer<typeof insertInvestmentSchema>;

// Insert schema for document library
export const insertDocumentLibrarySchema = createInsertSchema(
  documentLibrary
).omit({
  id: true,
  uploadedAt: true,
  updatedAt: true,
  archivedAt: true,
});

// Select type for document library
export type DocumentLibrary = typeof documentLibrary.$inferSelect;

// Insert type for document library
export type InsertDocumentLibrary = z.infer<typeof insertDocumentLibrarySchema>;

// Insert schema for investor verification documents
export const insertInvestorVerificationDocumentSchema = createInsertSchema(
  investorVerificationDocuments
).omit({
  id: true,
  uploadedAt: true,
  verifiedAt: true,
});

// Select type for investor verification documents
export type InvestorVerificationDocument =
  typeof investorVerificationDocuments.$inferSelect;

// Insert type for investor verification documents
export type InsertInvestorVerificationDocument = z.infer<
  typeof insertInvestorVerificationDocumentSchema
>;

// Insert schema for investor verification progress
export const insertInvestorVerificationProgressSchema = createInsertSchema(
  investorVerificationProgress
).omit({
  id: true,
  startedAt: true,
  completedAt: true,
  lastUpdatedAt: true,
  reviewedAt: true,
});

// Select type for investor verification progress
export type InvestorVerificationProgress =
  typeof investorVerificationProgress.$inferSelect;

// Insert type for investor verification progress
export type InsertInvestorVerificationProgress = z.infer<
  typeof insertInvestorVerificationProgressSchema
>;

// Insert schema for third-party verification requests
export const insertThirdPartyVerificationRequestSchema = createInsertSchema(
  thirdPartyVerificationRequests
).omit({
  id: true,
  requestedAt: true,
  completedAt: true,
  retryCount: true,
  lastRetryAt: true,
});

// Select type for third-party verification requests
export type ThirdPartyVerificationRequest =
  typeof thirdPartyVerificationRequests.$inferSelect;

// Insert type for third-party verification requests
export type InsertThirdPartyVerificationRequest = z.infer<
  typeof insertThirdPartyVerificationRequestSchema
>;