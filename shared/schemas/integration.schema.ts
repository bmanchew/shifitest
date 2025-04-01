import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  doublePrecision,
  json,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { merchants } from "./merchant.schema";
import { contracts } from "./contract.schema";

// Asset reports from Plaid
export const assetReports = pgTable("asset_reports", {
  id: serial("id").primaryKey(),
  merchantId: integer("merchant_id")
    .notNull()
    .references(() => merchants.id),
  contractId: integer("contract_id").references(() => contracts.id),
  assetReportId: text("asset_report_id").notNull(),
  assetReportToken: text("asset_report_token").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  daysRequested: integer("days_requested").notNull(),
  data: json("data"),
  status: text("status").notNull().default("pending"),
});

// Portfolio monitoring data from Plaid
export const portfolioMonitoring = pgTable("portfolio_monitoring", {
  id: serial("id").primaryKey(),
  merchantId: integer("merchant_id")
    .notNull()
    .references(() => merchants.id),
  contractId: integer("contract_id").references(() => contracts.id),
  monitoringId: text("monitoring_id").notNull(),
  lastUpdated: timestamp("last_updated").defaultNow(),
  status: text("status").notNull().default("active"),
  data: json("data"),
});

// CFPB complaints data for underwriting
export const complaintsData = pgTable("complaints_data", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull(),
  state: text("state"),
  zipCode: text("zip_code"),
  tags: text("tags").array(),
  productType: text("product_type"),
  submittedVia: text("submitted_via"),
  dateReceived: timestamp("date_received"),
  dateSentToCompany: timestamp("date_sent_to_company"),
  companyResponseToConsumer: text("company_response_to_consumer"),
  timelyResponse: text("timely_response"),
  consumerDisputed: text("consumer_disputed"),
  complaintId: text("complaint_id").notNull(),
  issue: text("issue"),
  subIssue: text("sub_issue"),
  complaintNarrative: text("complaint_narrative"),
  companyPublicResponse: text("company_public_response"),
  consumerConsentProvided: text("consumer_consent_provided"),
  numberOfComplaints: integer("number_of_complaints"),
  timePeriod: text("time_period"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
  metadata: json("metadata"),
});

// Third-party API integration credentials
export const integrationCredentials = pgTable("integration_credentials", {
  id: serial("id").primaryKey(),
  serviceName: text("service_name").notNull(),
  serviceType: text("service_type").notNull(),
  apiKey: text("api_key"),
  apiSecret: text("api_secret"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
  lastUsedAt: timestamp("last_used_at"),
  metadata: json("metadata"),
});

// Integration webhook events
export const webhookEvents = pgTable("webhook_events", {
  id: serial("id").primaryKey(),
  serviceName: text("service_name").notNull(),
  eventType: text("event_type").notNull(),
  eventId: text("event_id"),
  payload: json("payload").notNull(),
  receivedAt: timestamp("received_at").defaultNow(),
  processedAt: timestamp("processed_at"),
  status: text("status").notNull().default("received"),
  processingErrors: text("processing_errors"),
  retryCount: integer("retry_count").default(0),
  merchantId: integer("merchant_id").references(() => merchants.id),
  contractId: integer("contract_id").references(() => contracts.id),
  relatedEntityId: integer("related_entity_id"),
  relatedEntityType: text("related_entity_type"),
});

// Insert schema for asset reports
export const insertAssetReportSchema = createInsertSchema(assetReports).omit({
  id: true,
  createdAt: true,
});

// Select type for asset reports
export type AssetReport = typeof assetReports.$inferSelect;

// Insert type for asset reports
export type InsertAssetReport = z.infer<typeof insertAssetReportSchema>;

// Insert schema for portfolio monitoring
export const insertPortfolioMonitoringSchema = createInsertSchema(
  portfolioMonitoring
).omit({
  id: true,
  lastUpdated: true,
});

// Select type for portfolio monitoring
export type PortfolioMonitoring = typeof portfolioMonitoring.$inferSelect;

// Insert type for portfolio monitoring
export type InsertPortfolioMonitoring = z.infer<
  typeof insertPortfolioMonitoringSchema
>;

// Insert schema for complaints data
export const insertComplaintsDataSchema = createInsertSchema(
  complaintsData
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Select type for complaints data
export type ComplaintsData = typeof complaintsData.$inferSelect;

// Insert type for complaints data
export type InsertComplaintsData = z.infer<typeof insertComplaintsDataSchema>;

// Insert schema for integration credentials
export const insertIntegrationCredentialsSchema = createInsertSchema(
  integrationCredentials
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastUsedAt: true,
});

// Select type for integration credentials
export type IntegrationCredential = typeof integrationCredentials.$inferSelect;

// Insert type for integration credentials
export type InsertIntegrationCredential = z.infer<
  typeof insertIntegrationCredentialsSchema
>;

// Insert schema for webhook events
export const insertWebhookEventSchema = createInsertSchema(webhookEvents).omit({
  id: true,
  receivedAt: true,
  processedAt: true,
  retryCount: true,
});

// Select type for webhook events
export type WebhookEvent = typeof webhookEvents.$inferSelect;

// Insert type for webhook events
export type InsertWebhookEvent = z.infer<typeof insertWebhookEventSchema>;

// Functions to check if these tables exist in database
export const integrationTables = {
  assetReports,
  portfolioMonitoring,
  complaintsData,
  integrationCredentials,
  webhookEvents,
};