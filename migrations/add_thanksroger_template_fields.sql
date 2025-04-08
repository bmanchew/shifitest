-- Add external template fields to merchant_program_agreements table
ALTER TABLE merchant_program_agreements
ADD COLUMN IF NOT EXISTS external_template_id TEXT,
ADD COLUMN IF NOT EXISTS external_template_name TEXT;