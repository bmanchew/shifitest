import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { userRoleEnum } from "./enums";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name"),
  name: text("name"),
  lastName: text("last_name"),
  role: userRoleEnum("role").notNull().default("customer"),
  phone: text("phone"),
  emailVerified: boolean("email_verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Authentication tokens
export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  used: boolean("used").default(false),
});

export const oneTimePasswords = pgTable("one_time_passwords", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  otp: text("otp").notNull(),
  type: text("type").notNull().default("login"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  used: boolean("used").default(false),
  attempts: integer("attempts").default(0),
  lockoutUntil: timestamp("lockout_until"),
});

// Insert schema for users
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

// Select type for users
export type User = typeof users.$inferSelect;

// Insert type for users
export type InsertUser = z.infer<typeof insertUserSchema>;

// Insert schema for email verification tokens
export const insertEmailVerificationTokenSchema = createInsertSchema(
  emailVerificationTokens
).omit({
  id: true,
  createdAt: true,
});

// Select type for email verification tokens
export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;

// Insert type for email verification tokens
export type InsertEmailVerificationToken = z.infer<
  typeof insertEmailVerificationTokenSchema
>;

// Insert schema for password reset tokens
export const insertPasswordResetTokenSchema = createInsertSchema(
  passwordResetTokens
).omit({
  id: true,
  createdAt: true,
  used: true,
});

// Select type for password reset tokens
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

// Insert type for password reset tokens
export type InsertPasswordResetToken = z.infer<
  typeof insertPasswordResetTokenSchema
>;

// Insert schema for one-time passwords
export const insertOneTimePasswordSchema = createInsertSchema(
  oneTimePasswords
).omit({
  id: true,
  createdAt: true,
  used: true,
  attempts: true,
  lockoutUntil: true,
});

// Select type for one-time passwords
export type OneTimePassword = typeof oneTimePasswords.$inferSelect;

// Insert type for one-time passwords
export type InsertOneTimePassword = z.infer<
  typeof insertOneTimePasswordSchema
>;