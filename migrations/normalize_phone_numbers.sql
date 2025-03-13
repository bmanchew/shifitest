
-- Normalize phone numbers in users table (remove non-digits)
UPDATE "users"
SET "phone" = REGEXP_REPLACE(phone, '[^0-9]', '', 'g')
WHERE "phone" IS NOT NULL AND "phone" != '';

-- Normalize phone numbers in contracts table
UPDATE "contracts"
SET "phone_number" = REGEXP_REPLACE(phone_number, '[^0-9]', '', 'g')
WHERE "phone_number" IS NOT NULL AND "phone_number" != '';

-- Create index on phone for better lookup performance
CREATE INDEX IF NOT EXISTS "idx_users_phone" ON "users"("phone");

-- Create index on phone_number in contracts table
CREATE INDEX IF NOT EXISTS "idx_contracts_phone_number" ON "contracts"("phone_number");

-- Link any unlinked contracts to users by phone number
UPDATE "contracts" c
SET "customer_id" = u.id
FROM "users" u
WHERE c.customer_id IS NULL 
AND c.phone_number IS NOT NULL 
AND c.phone_number != '' 
AND c.phone_number = u.phone;
-- Normalize phone numbers in users table
UPDATE users 
SET phone = REGEXP_REPLACE(phone, '[^0-9]', '', 'g')
WHERE phone IS NOT NULL;

-- Normalize phone numbers in contracts table
UPDATE contracts
SET "phone_number" = REGEXP_REPLACE("phone_number", '[^0-9]', '', 'g')
WHERE "phone_number" IS NOT NULL;

-- Add indexes to speed up phone number lookups
CREATE INDEX IF NOT EXISTS users_phone_idx ON users (phone);
CREATE INDEX IF NOT EXISTS contracts_phone_idx ON contracts ("phone_number");
