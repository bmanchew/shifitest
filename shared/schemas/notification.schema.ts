/**
 * Notification Schema Module
 * Contains notification channels and in-app notifications
 */

import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { notifications } from "./communication.schema";
import { users } from "./user.schema";
import { notificationChannelEnum, notificationStatusEnum, notificationRecipientTypeEnum } from "./enums";

// Notification Channels
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

export const insertNotificationChannelSchema = createInsertSchema(
  notificationChannels,
).omit({
  id: true,
  sentAt: true,
  updatedAt: true,
});

export type NotificationChannel = typeof notificationChannels.$inferSelect;
export type InsertNotificationChannel = z.infer<
  typeof insertNotificationChannelSchema
>;

// In-App Notifications
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

export const insertInAppNotificationSchema = createInsertSchema(
  inAppNotifications,
).omit({
  id: true,
  createdAt: true,
  readAt: true,
});

export type InAppNotification = typeof inAppNotifications.$inferSelect;
export type InsertInAppNotification = z.infer<
  typeof insertInAppNotificationSchema
>;

// Customer Satisfaction Surveys
export const customerSatisfactionSurveys = pgTable("customer_satisfaction_surveys", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").notNull(),
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