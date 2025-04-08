-- Add funding source fields to contracts table
-- This migration adds fields to track which funding source was used for a contract
-- (ShiFi, CoveredCare, etc.) and store related funding data

-- Add the funding_source column
ALTER TABLE "contracts" ADD COLUMN "funding_source" text;

-- Add a JSON column for funding source specific data
ALTER TABLE "contracts" ADD COLUMN "funding_source_data" jsonb;

-- Add a column for funding source reference ID (loan number, etc.)
ALTER TABLE "contracts" ADD COLUMN "funding_source_reference_id" text;
