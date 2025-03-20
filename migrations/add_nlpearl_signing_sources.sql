-- Update the log_source enum to include 'nlpearl' and 'signing'
ALTER TYPE log_source ADD VALUE IF NOT EXISTS 'nlpearl';
ALTER TYPE log_source ADD VALUE IF NOT EXISTS 'signing';

-- Update the log_category enum to include 'sms' and 'underwriting'
ALTER TYPE log_category ADD VALUE IF NOT EXISTS 'sms';
ALTER TYPE log_category ADD VALUE IF NOT EXISTS 'underwriting';