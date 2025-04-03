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
import { cancellationStatusEnum, contractStatusEnum, contractTypeEnum } from "./enums";
import { merchants } from "./merchant.schema";
import { users } from "./user.schema";
import { 
  type SalesRep,
  type InsertSalesRep,
  type SalesRepAnalytics,
  type InsertSalesRepAnalytics,
  type Commission
} from './salesrep.schema';

// Contracts table
export const contracts = pgTable("contracts", {
  id: serial("id").primaryKey(),
  merchantId: integer("merchant_id")
    .notNull()
    .references(() => merchants.id),
  amount: doublePrecision("amount").notNull(),
  term: integer("term_months").notNull(), // months - renamed to match the main schema
  interestRate: doublePrecision("interest_rate").notNull(),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  status: contractStatusEnum("status").notNull().default("draft"),
  type: contractTypeEnum("type").notNull().default("standard_12mo"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
  createdBy: integer("created_by").references(() => users.id),
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  signedAt: timestamp("signed_at"),
  notes: text("notes"),
  contractNumber: text("contract_number"),
  metadata: json("metadata"),
  // Blockchain tokenization fields
  tokenized: boolean("tokenized").default(false),
  tokenId: text("token_id"),
  blockchainAddress: text("blockchain_address"),
  tokenizationTimestamp: timestamp("tokenization_timestamp"),
  tokenizationError: text("tokenization_error"),
  archived: boolean("archived").default(false),
});

// Contract cancellation requests
export const contractCancellationRequests = pgTable("contract_cancellation_requests", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id")
    .notNull()
    .references(() => contracts.id),
  merchantId: integer("merchant_id")
    .notNull()
    .references(() => merchants.id),
  requestedBy: integer("requested_by")
    .notNull()
    .references(() => users.id),
  requestDate: timestamp("request_date").defaultNow(),
  requestReason: text("request_reason").notNull(),
  requestNotes: text("request_notes"),
  status: cancellationStatusEnum("status").notNull().default("pending"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  processingFee: doublePrecision("processing_fee"),
  earlyTerminationFee: doublePrecision("early_termination_fee"),
  refundAmount: doublePrecision("refund_amount"),
  processedAt: timestamp("processed_at"),
  processedBy: integer("processed_by").references(() => users.id),
  metadata: json("metadata"),
});

// Underwriting data for contracts
export const underwritingData = pgTable("underwriting_data", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id")
    .notNull()
    .references(() => contracts.id),
  merchantId: integer("merchant_id")
    .notNull()
    .references(() => merchants.id),
  creditScore: integer("credit_score"),
  businessScore: integer("business_score"),
  annualRevenue: doublePrecision("annual_revenue"),
  monthlyRevenue: doublePrecision("monthly_revenue"),
  yearInBusiness: integer("year_in_business"),
  profitMargin: doublePrecision("profit_margin"),
  debtToIncomeRatio: doublePrecision("debt_to_income_ratio"),
  cashReserves: doublePrecision("cash_reserves"),
  industryRisk: text("industry_risk"),
  financialStability: text("financial_stability"),
  recommendation: text("recommendation"),
  recommendedAmount: doublePrecision("recommended_amount"),
  recommendedRate: doublePrecision("recommended_rate"),
  recommendedTerm: integer("recommended_term"),
  approvedAmount: doublePrecision("approved_amount"),
  approvedRate: doublePrecision("approved_rate"),
  approvedTerm: integer("approved_term"),
  decisionDate: timestamp("decision_date"),
  decisionBy: integer("decision_by").references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
  dataSource: text("data_source"),
  rawData: json("raw_data"),
});

// Sales representatives are defined in salesrep.schema.ts

// Blockchain transaction records for contracts
export const blockchainTransactions = pgTable("blockchain_transactions", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").references(() => contracts.id),
  transactionHash: text("transaction_hash").notNull(),
  blockchainNetwork: text("blockchain_network").notNull(),
  blockNumber: integer("block_number"),
  status: text("status").notNull(),
  type: text("type").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  confirmedAt: timestamp("confirmed_at"),
  data: json("data"),
  errorMessage: text("error_message"),
  gasUsed: integer("gas_used"),
  gasCost: doublePrecision("gas_cost"),
  metadata: json("metadata"),
});

// Commissions are defined in salesrep.schema.ts

// Insert schema for contracts
export const insertContractSchema = createInsertSchema(contracts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  approvedAt: true,
  signedAt: true,
  tokenized: true,
  tokenizationTimestamp: true,
  archived: true,
});

// Select type for contracts
export type Contract = typeof contracts.$inferSelect;

// Insert type for contracts
export type InsertContract = z.infer<typeof insertContractSchema>;

// Insert schema for contract cancellation requests
export const insertContractCancellationRequestSchema = createInsertSchema(
  contractCancellationRequests
).omit({
  id: true,
  requestDate: true,
  reviewedAt: true,
  processedAt: true,
});

// Select type for contract cancellation requests
export type ContractCancellationRequest = typeof contractCancellationRequests.$inferSelect;

// Insert type for contract cancellation requests
export type InsertContractCancellationRequest = z.infer<
  typeof insertContractCancellationRequestSchema
>;

// Insert schema for underwriting data
export const insertUnderwritingDataSchema = createInsertSchema(
  underwritingData
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  decisionDate: true,
});

// Select type for underwriting data
export type UnderwritingData = typeof underwritingData.$inferSelect;

// Insert type for underwriting data
export type InsertUnderwritingData = z.infer<
  typeof insertUnderwritingDataSchema
>;

// SalesRep, SalesRepAnalytics, and Commission types are imported from salesrep.schema.ts

// Insert schema for blockchain transactions
export const insertBlockchainTransactionSchema = createInsertSchema(
  blockchainTransactions
).omit({
  id: true,
  createdAt: true,
  confirmedAt: true,
});

// Select type for blockchain transactions
export type BlockchainTransaction = typeof blockchainTransactions.$inferSelect;

// Insert type for blockchain transactions
export type InsertBlockchainTransaction = z.infer<
  typeof insertBlockchainTransactionSchema
>;