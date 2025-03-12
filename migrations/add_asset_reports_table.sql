-- Add asset_reports table
CREATE TABLE IF NOT EXISTS public."asset_reports" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER REFERENCES public."users"("id"),
  "contract_id" INTEGER REFERENCES public."contracts"("id"),
  "asset_report_id" TEXT NOT NULL,
  "asset_report_token" TEXT NOT NULL,
  "plaid_item_id" TEXT,
  "days_requested" INTEGER DEFAULT 60,
  "status" TEXT DEFAULT 'pending',
  "analysis_data" TEXT,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "expires_at" TIMESTAMP,
  "refreshed_at" TIMESTAMP
);