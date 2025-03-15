-- Create onboarding_status enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'onboarding_status') THEN
        CREATE TYPE onboarding_status AS ENUM ('pending', 'in_progress', 'completed', 'rejected');
    END IF;
END
$$;

-- Create plaid_merchants table
CREATE TABLE IF NOT EXISTS plaid_merchants (
  id SERIAL PRIMARY KEY,
  merchant_id INTEGER NOT NULL UNIQUE REFERENCES merchants(id),
  plaid_customer_id TEXT,
  originator_id TEXT,
  onboarding_status onboarding_status NOT NULL DEFAULT 'pending',
  onboarding_url TEXT,
  questionnaire_id TEXT,
  plaid_data TEXT,
  access_token TEXT,
  account_id TEXT,
  default_funding_account TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);

-- Create plaid_transfers table
CREATE TABLE IF NOT EXISTS plaid_transfers (
  id SERIAL PRIMARY KEY,
  contract_id INTEGER REFERENCES contracts(id),
  merchant_id INTEGER REFERENCES merchants(id),
  transfer_id TEXT NOT NULL,
  originator_id TEXT,
  amount DOUBLE PRECISION NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  routed_to_shifi BOOLEAN NOT NULL DEFAULT FALSE,
  facilitator_fee DOUBLE PRECISION,
  metadata TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP
);