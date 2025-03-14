-- Add underwriting_data table
-- First check if the enum type exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credit_tier') THEN
        CREATE TYPE public.credit_tier AS ENUM ('tier1', 'tier2', 'tier3', 'declined');
    END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.underwriting_data (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.users(id),
  contract_id INTEGER REFERENCES public.contracts(id),
  credit_tier credit_tier NOT NULL,
  credit_score INTEGER,
  annual_income DOUBLE PRECISION,
  annual_income_points INTEGER,
  employment_history_months INTEGER,
  employment_history_points INTEGER,
  credit_score_points INTEGER,
  dti_ratio DOUBLE PRECISION,
  dti_ratio_points INTEGER,
  housing_status TEXT,
  housing_payment_history_months INTEGER,
  housing_status_points INTEGER,
  delinquency_history TEXT,
  delinquency_points INTEGER,
  total_points INTEGER NOT NULL,
  raw_prefi_data TEXT,
  raw_plaid_data TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);