
-- Add archived fields to contracts table
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS archived_reason TEXT;

-- Index for archived field to improve query performance
CREATE INDEX IF NOT EXISTS idx_contracts_archived ON contracts(archived);
