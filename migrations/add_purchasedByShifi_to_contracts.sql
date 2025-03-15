-- Add purchasedByShifi column to contracts table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='purchased_by_shifi') THEN
    ALTER TABLE contracts ADD COLUMN purchased_by_shifi BOOLEAN NOT NULL DEFAULT false;
  END IF;
END
$$;