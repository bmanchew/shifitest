-- Add tokenization_error field to contracts table
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS tokenization_error TEXT;