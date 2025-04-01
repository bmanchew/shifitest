import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  json,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import {
  conversationStatusEnum,
  messageChannelEnum,
  messageStatusEnum,
  notificationStatusEnum,
  ticketPriorityEnum,
  ticketStatusEnum,
  ticketTypeEnum,
} from "./enums";
import { contracts } from "./contract.schema";
import { merchants } from "./merchant.schema";
import { users } from "./user.schema";

// Conversations
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  merchantId: integer("merchant_id")
    .notNull()
    .references(() => merchants.id),
  contractId: integer("contract_id").references(() => contracts.id),
  subject: text("subject").notNull(),
  status: conversationStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
  lastMessageAt: timestamp("last_message_at"),
  archivedAt: timestamp("archived_at"),
  archivedBy: integer("archived_by").references(() => users.id),
  metadata: json("metadata"),
});

// Messages
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id")
    .notNull()
    .references(() => conversations.id),
  senderId: integer("sender_id")
    .notNull()
    .references(() => users.id),
  content: text("content").notNull(),
  sentAt: timestamp("sent_at").defaultNow(),
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  metadata: json("metadata"),
});

// Support tickets
export const supportTickets = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  merchantId: integer("merchant_id")
    .notNull()
    .references(() => merchants.id),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  status: ticketStatusEnum("status").notNull().default("new"),
  priority: ticketPriorityEnum("priority").notNull().default("normal"),
  type: ticketTypeEnum("type").notNull(),
  assignedTo: integer("assigned_to").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: integer("resolved_by").references(() => users.id),
  metadata: json("metadata"),
});

// Ticket attachments
export const ticketAttachments = pgTable("ticket_attachments", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id")
    .notNull()
    .references(() => supportTickets.id),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size"),
  fileType: text("file_type"),
  uploadedBy: integer("uploaded_by")
    .notNull()
    .references(() => users.id),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

// Ticket activity log
export const ticketActivityLog = pgTable("ticket_activity_log", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id")
    .notNull()
    .references(() => supportTickets.id),
  activityType: text("activity_type").notNull(),
  activityDescription: text("activity_description").notNull(),
  performedBy: integer("performed_by")
    .notNull()
    .references(() => users.id),
  performedAt: timestamp("performed_at").defaultNow(),
  previousStatus: ticketStatusEnum("previous_status"),
  newStatus: ticketStatusEnum("new_status"),
  previousPriority: ticketPriorityEnum("previous_priority"),
  newPriority: ticketPriorityEnum("new_priority"),
  previousAssignee: integer("previous_assignee").references(() => users.id),
  newAssignee: integer("new_assignee").references(() => users.id),
  systemGenerated: boolean("system_generated").default(false),
  metadata: json("metadata"),
});

// Notifications
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  readAt: timestamp("read_at"),
  expiresAt: timestamp("expires_at"),
  metadata: json("metadata"),
  userType: text("user_type").notNull(),
  relatedId: integer("related_id"),
  relatedType: text("related_type"),
  priority: text("priority").default("normal"),
  sentViaEmail: boolean("sent_via_email").default(false),
  sentViaSms: boolean("sent_via_sms").default(false),
  emailStatus: notificationStatusEnum("email_status"),
  smsStatus: notificationStatusEnum("sms_status"),
});

// Logs table (for system/audit logs)
export const logs = pgTable("logs", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").defaultNow(),
  userId: integer("user_id").references(() => users.id),
  message: text("message").notNull(),
  level: text("level").notNull().default("info"),
  category: text("category"),
  source: text("source"),
  metadata: json("metadata"),
  ip: text("ip"),
  userAgent: text("user_agent"),
  path: text("path"),
  method: text("method"),
  statusCode: integer("status_code"),
  responseTime: integer("response_time"),
  requestId: text("request_id"),
});

// Insert schema for conversations
export const insertConversationSchema = createInsertSchema(
  conversations
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastMessageAt: true,
  archivedAt: true,
});

// Select type for conversations
export type Conversation = typeof conversations.$inferSelect;

// Insert type for conversations
export type InsertConversation = z.infer<typeof insertConversationSchema>;

// Insert schema for messages
export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  sentAt: true,
  isRead: true,
  readAt: true,
});

// Select type for messages
export type Message = typeof messages.$inferSelect;

// Insert type for messages
export type InsertMessage = z.infer<typeof insertMessageSchema>;

// Insert schema for support tickets
export const insertSupportTicketSchema = createInsertSchema(
  supportTickets
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
});

// Select type for support tickets
export type SupportTicket = typeof supportTickets.$inferSelect;

// Insert type for support tickets
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;

// Insert schema for ticket attachments
export const insertTicketAttachmentSchema = createInsertSchema(
  ticketAttachments
).omit({
  id: true,
  uploadedAt: true,
});

// Select type for ticket attachments
export type TicketAttachment = typeof ticketAttachments.$inferSelect;

// Insert type for ticket attachments
export type InsertTicketAttachment = z.infer<
  typeof insertTicketAttachmentSchema
>;

// Insert schema for ticket activity log
export const insertTicketActivityLogSchema = createInsertSchema(
  ticketActivityLog
).omit({
  id: true,
  performedAt: true,
  systemGenerated: true,
});

// Select type for ticket activity log
export type TicketActivityLog = typeof ticketActivityLog.$inferSelect;

// Insert type for ticket activity log
export type InsertTicketActivityLog = z.infer<
  typeof insertTicketActivityLogSchema
>;

// Insert schema for notifications
export const insertNotificationSchema = createInsertSchema(
  notifications
).omit({
  id: true,
  createdAt: true,
  readAt: true,
  isRead: true,
  sentViaEmail: true,
  sentViaSms: true,
});

// Select type for notifications
export type Notification = typeof notifications.$inferSelect;

// Insert type for notifications
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

// Insert schema for logs
export const insertLogSchema = createInsertSchema(logs).omit({
  id: true,
  timestamp: true,
});

// Select type for logs
export type Log = typeof logs.$inferSelect;

// Insert type for logs
export type InsertLog = z.infer<typeof insertLogSchema>;