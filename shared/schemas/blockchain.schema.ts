/**
 * Blockchain Schema Module
 * Contains smart contract templates and deployments
 */

import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { merchants } from "./merchant.schema";
import { users } from "./user.schema";
import { smartContractTypeEnum } from "./enums";

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