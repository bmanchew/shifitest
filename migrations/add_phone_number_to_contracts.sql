
-- Add phone_number column to contracts table
ALTER TABLE "contracts" ADD COLUMN IF NOT EXISTS "phone_number" text;

-- Update existing contracts by getting phone from user if possible
UPDATE "contracts" c
SET "phone_number" = u.phone
FROM "users" u
WHERE c.customer_id = u.id
AND c.phone_number IS NULL
AND u.phone IS NOT NULL;
