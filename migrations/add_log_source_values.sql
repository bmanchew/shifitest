-- Add missing values to the enum
ALTER TYPE log_source ADD VALUE IF NOT EXISTS 'stripe';
ALTER TYPE log_source ADD VALUE IF NOT EXISTS 'cfpb';