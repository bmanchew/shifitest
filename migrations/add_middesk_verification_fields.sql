-- Add MidDesk verification related fields to merchant_business_details table

-- Add verification_status enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_status') THEN
        CREATE TYPE verification_status AS ENUM ('not_started', 'pending', 'verified', 'failed');
    END IF;
END
$$;

-- Add middesk to log_source enum if it doesn't exist
DO $$
BEGIN
    ALTER TYPE log_source ADD VALUE IF NOT EXISTS 'middesk';
END
$$;

-- Add new columns to merchant_business_details table
ALTER TABLE merchant_business_details
ADD COLUMN IF NOT EXISTS formation_date TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS middesk_business_id TEXT,
ADD COLUMN IF NOT EXISTS verification_status verification_status DEFAULT 'not_started',
ADD COLUMN IF NOT EXISTS verification_data TEXT;