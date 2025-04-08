-- Add merchant_programs table
CREATE TABLE IF NOT EXISTS "merchant_programs" (
  "id" serial PRIMARY KEY NOT NULL,
  "merchant_id" integer NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "duration_months" integer NOT NULL,
  "active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp,
  CONSTRAINT "merchant_programs_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE
);
--> statement-breakpoint

-- Add merchant_program_agreements table
CREATE TABLE IF NOT EXISTS "merchant_program_agreements" (
  "id" serial PRIMARY KEY NOT NULL,
  "program_id" integer NOT NULL,
  "filename" text NOT NULL,
  "original_filename" text NOT NULL,
  "mime_type" text NOT NULL,
  "data" text NOT NULL,
  "file_size" integer,
  "uploaded_at" timestamp DEFAULT now(),
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp,
  "active" boolean DEFAULT true,
  CONSTRAINT "merchant_program_agreements_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "merchant_programs"("id") ON DELETE CASCADE
);
--> statement-breakpoint

-- Add program_id column to contracts table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name='contracts' AND column_name='program_id') THEN
        ALTER TABLE "contracts" ADD COLUMN "program_id" integer;
        ALTER TABLE "contracts" ADD CONSTRAINT "contracts_program_id_fkey" 
            FOREIGN KEY ("program_id") REFERENCES "merchant_programs"("id");
    END IF;
END $$;