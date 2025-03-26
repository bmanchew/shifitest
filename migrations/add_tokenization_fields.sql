-- Add tokenization status enum
CREATE TYPE tokenization_status AS ENUM ('none', 'processing', 'completed', 'failed');

-- Add tokenization fields to contracts table
ALTER TABLE contracts
  ADD COLUMN tokenization_status tokenization_status NOT NULL DEFAULT 'none',
  ADD COLUMN token_id text,
  ADD COLUMN smart_contract_address text,
  ADD COLUMN blockchain_transaction_hash text,
  ADD COLUMN block_number integer,
  ADD COLUMN tokenization_date timestamp,
  ADD COLUMN token_metadata jsonb,
  ADD COLUMN tokenization_error text;

-- Add index on token_id for faster lookups
CREATE INDEX IF NOT EXISTS contracts_token_id_idx ON contracts(token_id);