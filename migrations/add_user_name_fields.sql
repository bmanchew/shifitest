
-- Add first_name and last_name columns to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "first_name" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_name" text;

-- Update existing users to split their name field if it exists
UPDATE "users" 
SET 
  "first_name" = SPLIT_PART("name", ' ', 1),
  "last_name" = SUBSTRING("name" FROM POSITION(' ' IN "name") + 1)
WHERE "name" IS NOT NULL AND "name" != '' AND POSITION(' ' IN "name") > 0;

-- For users with just a single name, put it in first_name
UPDATE "users"
SET "first_name" = "name"
WHERE "name" IS NOT NULL AND "name" != '' AND POSITION(' ' IN "name") = 0 AND "first_name" IS NULL;
