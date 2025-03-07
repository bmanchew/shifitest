import { pgTable, text, serial, integer, boolean, timestamp, doublePrecision, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'merchant', 'customer']);
export const contractStatusEnum = pgEnum('contract_status', ['pending', 'active', 'completed', 'declined', 'cancelled']);
export const applicationStepEnum = pgEnum('application_step', ['terms', 'kyc', 'bank', 'payment', 'signing', 'completed']);
export const logLevelEnum = pgEnum('log_level', ['debug', 'info', 'warn', 'error', 'critical']);
export const logCategoryEnum = pgEnum('log_category', ['system', 'user', 'api', 'payment', 'security', 'contract']);
export const logSourceEnum = pgEnum('log_source', ['internal', 'twilio', 'didit', 'plaid', 'thanksroger', 'prefi']);
export const creditTierEnum = pgEnum('credit_tier', ['tier1', 'tier2', 'tier3', 'disqualified']);
export const underwritingStatusEnum = pgEnum('underwriting_status', ['pending', 'approved', 'conditional', 'declined']);

// Users
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
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

// Credit Profile
export const creditProfiles = pgTable("credit_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  contractId: integer("contract_id").references(() => contracts.id),
  creditScore: integer("credit_score"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  consentIp: text("consent_ip").notNull(),
  consentDate: timestamp("consent_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  preFiData: text("prefi_data"), // JSON stringified data from Pre-Fi
  plaidAssetsData: text("plaid_assets_data"), // JSON stringified data from Plaid Assets
});

export const insertCreditProfileSchema = createInsertSchema(creditProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Underwriting
export const underwriting = pgTable("underwriting", {
  id: serial("id").primaryKey(),
  creditProfileId: integer("credit_profile_id").references(() => creditProfiles.id).notNull(),
  contractId: integer("contract_id").references(() => contracts.id).notNull(),
  creditTier: creditTierEnum("credit_tier"),
  status: underwritingStatusEnum("status").default("pending"),
  totalScore: integer("total_score"),
  annualIncomePoints: integer("annual_income_points"),
  employmentHistoryPoints: integer("employment_history_points"),
  creditScorePoints: integer("credit_score_points"),
  dtiRatioPoints: integer("dti_ratio_points"),
  housingStatusPoints: integer("housing_status_points"),
  delinquencyHistoryPoints: integer("delinquency_history_points"),
  annualIncome: doublePrecision("annual_income"),
  dtiRatio: doublePrecision("dti_ratio"),
  contingencies: text("contingencies"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  data: text("data"), // JSON stringified additional data
});

export const insertUnderwritingSchema = createInsertSchema(underwriting).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
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

export type CreditProfile = typeof creditProfiles.$inferSelect;
export type InsertCreditProfile = z.infer<typeof insertCreditProfileSchema>;

export type Underwriting = typeof underwriting.$inferSelect;
export type InsertUnderwriting = z.infer<typeof insertUnderwritingSchema>;

export type Log = typeof logs.$inferSelect;
export type InsertLog = z.infer<typeof insertLogSchema>;
