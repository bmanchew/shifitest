-- Create portfolio_monitoring table
CREATE TABLE IF NOT EXISTS "portfolio_monitoring" (
  "id" SERIAL PRIMARY KEY,
  "last_credit_check_date" TIMESTAMP,
  "last_asset_verification_date" TIMESTAMP,
  "next_credit_check_date" TIMESTAMP,
  "next_asset_verification_date" TIMESTAMP,
  "portfolio_health_score" DOUBLE PRECISION,
  "risk_metrics" TEXT,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP
);

-- Add initial record to avoid null reference issues
INSERT INTO "portfolio_monitoring" (
  "last_credit_check_date",
  "last_asset_verification_date",
  "next_credit_check_date",
  "next_asset_verification_date",
  "portfolio_health_score",
  "risk_metrics",
  "created_at",
  "updated_at"
) VALUES (
  NOW(),
  NOW(),
  NOW() + INTERVAL '3 MONTHS',
  NOW() + INTERVAL '1 MONTH',
  85.5,
  '{"defaultRate": 2.1, "latePaymentRate": 3.5, "portfolioDiversity": "good"}',
  NOW(),
  NOW()
);