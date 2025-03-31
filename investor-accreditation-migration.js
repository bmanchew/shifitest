/**
 * This script runs the migration for the investor accreditation verification portal
 * using direct SQL statements
 */

import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  console.log('Starting investor accreditation migration...');
  const client = await pool.connect();
  
  try {
    // Start a transaction
    await client.query('BEGIN');
    
    console.log('Creating new enum types...');
    
    // Create verification_step enum
    await client.query(`
      DO $$ 
      BEGIN
        -- Check and create the verification_step enum
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_step') THEN
          CREATE TYPE verification_step AS ENUM (
            'identity', 'income', 'net_worth', 'professional_certification', 
            'questionnaire', 'agreement', 'review'
          );
        END IF;
      END $$;
    `);
    
    // Create investor_document_type enum
    await client.query(`
      DO $$ 
      BEGIN
        -- Check and create the investor_document_type enum
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'investor_document_type') THEN
          CREATE TYPE investor_document_type AS ENUM (
            'tax_w2', 'tax_1040', 'tax_1099', 'bank_statement', 'investment_statement',
            'cpa_letter', 'attorney_letter', 'government_id', 'professional_license',
            'financial_statement', 'proof_of_address', 'other'
          );
        END IF;
      END $$;
    `);
    
    // Create accreditation_method enum
    await client.query(`
      DO $$ 
      BEGIN
        -- Check and create the accreditation_method enum
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'accreditation_method') THEN
          CREATE TYPE accreditation_method AS ENUM (
            'income', 'net_worth', 'professional_certification', 'entity'
          );
        END IF;
      END $$;
    `);
    
    // Create third_party_verification_status enum
    await client.query(`
      DO $$ 
      BEGIN
        -- Check and create the third_party_verification_status enum
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'third_party_verification_status') THEN
          CREATE TYPE third_party_verification_status AS ENUM (
            'pending', 'sent', 'viewed', 'completed', 'rejected', 'expired'
          );
        END IF;
      END $$;
    `);
    
    // Update/create investor_verification_status enum
    await client.query(`
      DO $$ 
      BEGIN
        -- Update the investor_verification_status enum with new statuses if it exists
        IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'investor_verification_status') THEN
          -- Add new values if they don't exist
          IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'under_review' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'investor_verification_status')) THEN
            ALTER TYPE investor_verification_status ADD VALUE 'under_review';
          END IF;

          IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'incomplete' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'investor_verification_status')) THEN
            ALTER TYPE investor_verification_status ADD VALUE 'incomplete';
          END IF;
        ELSE
          -- Create the enum if it doesn't exist
          CREATE TYPE investor_verification_status AS ENUM (
            'not_started', 'pending', 'verified', 'rejected', 'under_review', 'incomplete'
          );
        END IF;
      END $$;
    `);
    
    console.log('Adding new fields to investor_profiles table...');
    
    // Modify investor_profiles table to add new fields
    await client.query(`
      DO $$ 
      BEGIN
        -- Check if the columns already exist in investor_profiles table, if not add them
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'investor_profiles' AND column_name = 'accreditation_method') THEN
          ALTER TABLE investor_profiles ADD COLUMN accreditation_method accreditation_method;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'investor_profiles' AND column_name = 'kyc_passed') THEN
          ALTER TABLE investor_profiles ADD COLUMN kyc_passed BOOLEAN DEFAULT FALSE;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'investor_profiles' AND column_name = 'date_of_birth') THEN
          ALTER TABLE investor_profiles ADD COLUMN date_of_birth TIMESTAMP;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'investor_profiles' AND column_name = 'marital_status') THEN
          ALTER TABLE investor_profiles ADD COLUMN marital_status TEXT;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'investor_profiles' AND column_name = 'citizenship_status') THEN
          ALTER TABLE investor_profiles ADD COLUMN citizenship_status TEXT;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'investor_profiles' AND column_name = 'primary_residence_value') THEN
          ALTER TABLE investor_profiles ADD COLUMN primary_residence_value DOUBLE PRECISION;
        END IF;

        -- Professional certification fields
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'investor_profiles' AND column_name = 'professional_license_type') THEN
          ALTER TABLE investor_profiles ADD COLUMN professional_license_type TEXT;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'investor_profiles' AND column_name = 'professional_license_number') THEN
          ALTER TABLE investor_profiles ADD COLUMN professional_license_number TEXT;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'investor_profiles' AND column_name = 'professional_license_verified') THEN
          ALTER TABLE investor_profiles ADD COLUMN professional_license_verified BOOLEAN DEFAULT FALSE;
        END IF;

        -- Income verification
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'investor_profiles' AND column_name = 'income_verified') THEN
          ALTER TABLE investor_profiles ADD COLUMN income_verified BOOLEAN DEFAULT FALSE;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'investor_profiles' AND column_name = 'income_verification_method') THEN
          ALTER TABLE investor_profiles ADD COLUMN income_verification_method TEXT;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'investor_profiles' AND column_name = 'joint_income') THEN
          ALTER TABLE investor_profiles ADD COLUMN joint_income BOOLEAN DEFAULT FALSE;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'investor_profiles' AND column_name = 'current_year_income_expectation') THEN
          ALTER TABLE investor_profiles ADD COLUMN current_year_income_expectation DOUBLE PRECISION;
        END IF;

        -- Net worth verification
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'investor_profiles' AND column_name = 'net_worth_verified') THEN
          ALTER TABLE investor_profiles ADD COLUMN net_worth_verified BOOLEAN DEFAULT FALSE;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'investor_profiles' AND column_name = 'net_worth_verification_method') THEN
          ALTER TABLE investor_profiles ADD COLUMN net_worth_verification_method TEXT;
        END IF;

        -- Review information
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'investor_profiles' AND column_name = 'reviewed_by') THEN
          ALTER TABLE investor_profiles ADD COLUMN reviewed_by INTEGER REFERENCES users(id);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'investor_profiles' AND column_name = 'reviewed_at') THEN
          ALTER TABLE investor_profiles ADD COLUMN reviewed_at TIMESTAMP;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'investor_profiles' AND column_name = 'admin_notes') THEN
          ALTER TABLE investor_profiles ADD COLUMN admin_notes TEXT;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'investor_profiles' AND column_name = 'rejection_reason') THEN
          ALTER TABLE investor_profiles ADD COLUMN rejection_reason TEXT;
        END IF;

        -- Verification expiration
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'investor_profiles' AND column_name = 'verification_expires_at') THEN
          ALTER TABLE investor_profiles ADD COLUMN verification_expires_at TIMESTAMP;
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'investor_profiles' AND column_name = 'last_reverification_request_date') THEN
          ALTER TABLE investor_profiles ADD COLUMN last_reverification_request_date TIMESTAMP;
        END IF;
      END $$;
    `);
    
    console.log('Creating investor verification documents table...');
    
    // Create investor_verification_documents table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS investor_verification_documents (
        id SERIAL PRIMARY KEY,
        investor_id INTEGER NOT NULL REFERENCES investor_profiles(id),
        document_type investor_document_type NOT NULL,
        file_url TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        uploaded_at TIMESTAMP DEFAULT NOW(),
        verification_purpose TEXT NOT NULL,
        year INTEGER,
        verified BOOLEAN DEFAULT FALSE,
        verified_at TIMESTAMP,
        verified_by INTEGER REFERENCES users(id),
        rejection_reason TEXT,
        admin_notes TEXT,
        expires_at TIMESTAMP,
        metadata TEXT,
        ocr_data TEXT
      );
    `);
    
    console.log('Creating investor verification progress table...');
    
    // Create investor_verification_progress table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS investor_verification_progress (
        id SERIAL PRIMARY KEY,
        investor_id INTEGER NOT NULL REFERENCES investor_profiles(id),
        step verification_step NOT NULL,
        completed BOOLEAN DEFAULT FALSE,
        started_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP,
        data TEXT,
        admin_review_required BOOLEAN DEFAULT FALSE,
        admin_reviewed BOOLEAN DEFAULT FALSE,
        admin_reviewed_at TIMESTAMP,
        admin_reviewed_by INTEGER REFERENCES users(id),
        admin_notes TEXT
      );
    `);
    
    console.log('Creating third-party verification requests table...');
    
    // Create third_party_verification_requests table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS third_party_verification_requests (
        id SERIAL PRIMARY KEY,
        investor_id INTEGER NOT NULL REFERENCES investor_profiles(id),
        verifier_email TEXT NOT NULL,
        verifier_name TEXT,
        verifier_type TEXT NOT NULL,
        verification_purpose TEXT NOT NULL,
        status third_party_verification_status NOT NULL DEFAULT 'pending',
        request_token TEXT NOT NULL UNIQUE,
        message TEXT,
        requested_at TIMESTAMP DEFAULT NOW(),
        sent_at TIMESTAMP,
        viewed_at TIMESTAMP,
        completed_at TIMESTAMP,
        reminder_sent_at TIMESTAMP,
        expires_at TIMESTAMP,
        verifier_response TEXT,
        verifier_notes TEXT,
        document_url TEXT,
        admin_reviewed BOOLEAN DEFAULT FALSE,
        admin_reviewed_at TIMESTAMP,
        admin_reviewed_by INTEGER REFERENCES users(id),
        admin_notes TEXT
      );
    `);
    
    // Commit the transaction
    await client.query('COMMIT');
    
    console.log('Investor accreditation migration completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in investor accreditation migration:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log('Migration script completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('Migration script failed:', err);
    process.exit(1);
  });