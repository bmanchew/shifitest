-- Make sure the tokenization_status enum exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tokenization_status') THEN
        CREATE TYPE tokenization_status AS ENUM ('pending', 'processing', 'tokenized', 'failed');
    END IF;
END$$;

-- Add tokenization fields to contracts table
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS tokenization_status tokenization_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS token_id text,
  ADD COLUMN IF NOT EXISTS smart_contract_address text,
  ADD COLUMN IF NOT EXISTS blockchain_transaction_hash text,
  ADD COLUMN IF NOT EXISTS block_number integer,
  ADD COLUMN IF NOT EXISTS tokenization_date timestamp,
  ADD COLUMN IF NOT EXISTS token_metadata text;

-- Add index on token_id for faster lookups
CREATE INDEX IF NOT EXISTS contracts_token_id_idx ON contracts(token_id);