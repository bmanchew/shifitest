CREATE TYPE "public"."application_step" AS ENUM('terms', 'kyc', 'bank', 'payment', 'signing', 'completed');--> statement-breakpoint
CREATE TYPE "public"."contract_status" AS ENUM('pending', 'active', 'completed', 'declined', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."credit_tier" AS ENUM('tier1', 'tier2', 'tier3', 'declined');--> statement-breakpoint
CREATE TYPE "public"."log_category" AS ENUM('system', 'user', 'api', 'payment', 'security', 'contract');--> statement-breakpoint
CREATE TYPE "public"."log_level" AS ENUM('debug', 'info', 'warn', 'error', 'critical');--> statement-breakpoint
CREATE TYPE "public"."log_source" AS ENUM('internal', 'twilio', 'didit', 'plaid', 'thanksroger', 'prefi');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'merchant', 'customer');--> statement-breakpoint
CREATE TABLE "application_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_id" integer NOT NULL,
	"step" "application_step" NOT NULL,
	"completed" boolean DEFAULT false,
	"data" text,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" serial PRIMARY KEY NOT NULL,
	"contract_number" text NOT NULL,
	"merchant_id" integer NOT NULL,
	"customer_id" integer,
	"amount" double precision NOT NULL,
	"down_payment" double precision NOT NULL,
	"financed_amount" double precision NOT NULL,
	"term_months" integer DEFAULT 24 NOT NULL,
	"interest_rate" double precision DEFAULT 0 NOT NULL,
	"monthly_payment" double precision NOT NULL,
	"status" "contract_status" DEFAULT 'pending' NOT NULL,
	"current_step" "application_step" DEFAULT 'terms' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	CONSTRAINT "contracts_contract_number_unique" UNIQUE("contract_number")
);
--> statement-breakpoint
CREATE TABLE "logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" timestamp DEFAULT now(),
	"level" "log_level" DEFAULT 'info' NOT NULL,
	"category" "log_category" DEFAULT 'system' NOT NULL,
	"message" text NOT NULL,
	"user_id" integer,
	"source" "log_source" DEFAULT 'internal' NOT NULL,
	"request_id" text,
	"correlation_id" text,
	"metadata" text,
	"ip_address" text,
	"user_agent" text,
	"tags" text[],
	"duration" integer,
	"status_code" integer,
	"retention_days" integer DEFAULT 90
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"contact_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"address" text,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"user_id" integer,
	CONSTRAINT "merchants_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "underwriting_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"contract_id" integer,
	"credit_tier" "credit_tier" NOT NULL,
	"credit_score" integer,
	"annual_income" double precision,
	"annual_income_points" integer,
	"employment_history_months" integer,
	"employment_history_points" integer,
	"credit_score_points" integer,
	"dti_ratio" double precision,
	"dti_ratio_points" integer,
	"housing_status" text,
	"housing_payment_history_months" integer,
	"housing_status_points" integer,
	"delinquency_history" text,
	"delinquency_points" integer,
	"total_points" integer NOT NULL,
	"raw_prefi_data" text,
	"raw_plaid_data" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"name" text,
	"role" "user_role" DEFAULT 'customer' NOT NULL,
	"phone" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "application_progress" ADD CONSTRAINT "application_progress_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logs" ADD CONSTRAINT "logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "underwriting_data" ADD CONSTRAINT "underwriting_data_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "underwriting_data" ADD CONSTRAINT "underwriting_data_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE no action ON UPDATE no action;