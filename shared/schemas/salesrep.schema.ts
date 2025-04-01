/**
 * Sales Rep Schema Module
 * Contains sales representatives and commission-related tables
 */

import { pgTable, serial, integer, text, timestamp, doublePrecision, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./user.schema";
import { merchants } from "./merchant.schema";
import { contracts } from "./contract.schema";
import { commissionRateTypeEnum } from "./enums";

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
  commission: doublePrecision("commission").default(0),
  commissionType: commissionRateTypeEnum("commission_type").default("percentage"), // percentage or fixed
  active: boolean("active").default(true),
  title: text("title"),
  hireDate: timestamp("hire_date").defaultNow(),
  territory: text("territory"),
  notes: text("notes"),
  metadata: text("metadata"), // JSON stringified additional data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// Commissions table
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

// Insert schema for commissions
export const insertCommissionSchema = createInsertSchema(
  commissions
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  paidAt: true,
});

// Sales Rep Analytics (performance data)
export const salesRepAnalytics = pgTable("sales_rep_analytics", {
  id: serial("id").primaryKey(),
  salesRepId: integer("sales_rep_id")
    .references(() => salesReps.id)
    .notNull(),
  period: text("period").notNull(), // e.g., "2023-01", "2023-Q1"
  contractsCreated: integer("contracts_created"), // Total contracts created
  contractsApproved: integer("contracts_approved"), // Total contracts approved
  totalCommission: doublePrecision("total_commission"), // Total commission earned in the period
  totalContractValue: doublePrecision("total_contract_value"), // Total value of contracts
  conversionRate: doublePrecision("conversion_rate"), // Percentage of contracts approved
  avgContractValue: doublePrecision("avg_contract_value"), // Average contract value
  customerRetentionRate: doublePrecision("customer_retention_rate"), // Percentage of repeat customers
  leadCount: integer("lead_count"), // Number of leads generated
  metadata: text("metadata"), // JSON stringified additional data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
});

// Insert schema for sales reps
export const insertSalesRepSchema = createInsertSchema(
  salesReps
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Insert schema for sales rep analytics
export const insertSalesRepAnalyticsSchema = createInsertSchema(
  salesRepAnalytics
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Type definitions
export type SalesRep = typeof salesReps.$inferSelect;
export type InsertSalesRep = z.infer<typeof insertSalesRepSchema>;

export type SalesRepAnalytics = typeof salesRepAnalytics.$inferSelect;
export type InsertSalesRepAnalytics = z.infer<typeof insertSalesRepAnalyticsSchema>;

export type Commission = typeof commissions.$inferSelect;
export type InsertCommission = z.infer<typeof insertCommissionSchema>;