import { SQL, sql } from "drizzle-orm";
import { db } from "../db";
import { logger } from "../services/logger";

/**
 * Migration script for investor accreditation verification
 * 
 * This script adds tables required for managing investor accreditation verification
 * including document storage, verification progress tracking, and third-party
 * verification requests.
 */
export async function migrateInvestorAccreditation() {
  try {
    // Check if investor_verification_documents table exists
    const documentTableExists = await doesTableExist('investor_verification_documents');
    if (!documentTableExists) {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS investor_verification_documents (
          id SERIAL PRIMARY KEY,
          investor_id INTEGER NOT NULL REFERENCES investor_profiles(id),
          document_type VARCHAR(255) NOT NULL,
          file_url VARCHAR(255) NOT NULL,
          file_name VARCHAR(255) NOT NULL,
          file_type VARCHAR(50) NOT NULL,
          file_size INTEGER NOT NULL,
          verification_purpose VARCHAR(50) NOT NULL,
          verified BOOLEAN DEFAULT FALSE,
          verified_at TIMESTAMP,
          verified_by INTEGER REFERENCES users(id),
          uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          year INTEGER,
          rejection_reason TEXT,
          notes TEXT
        );
      `);
      logger.info("Created investor_verification_documents table");
    }

    // Check if investor_verification_progress table exists
    const progressTableExists = await doesTableExist('investor_verification_progress');
    if (!progressTableExists) {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS investor_verification_progress (
          id SERIAL PRIMARY KEY,
          investor_id INTEGER NOT NULL REFERENCES investor_profiles(id),
          step VARCHAR(50) NOT NULL,
          completed BOOLEAN DEFAULT FALSE,
          started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP,
          admin_reviewed BOOLEAN DEFAULT FALSE,
          admin_reviewed_at TIMESTAMP,
          admin_reviewed_by INTEGER REFERENCES users(id),
          admin_notes TEXT,
          admin_review_required BOOLEAN DEFAULT TRUE,
          data JSONB
        );
      `);
      logger.info("Created investor_verification_progress table");
    }

    // Check if third_party_verification_requests table exists
    const thirdPartyTableExists = await doesTableExist('third_party_verification_requests');
    if (!thirdPartyTableExists) {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS third_party_verification_requests (
          id SERIAL PRIMARY KEY,
          investor_id INTEGER NOT NULL REFERENCES investor_profiles(id),
          verifier_email VARCHAR(255) NOT NULL,
          verifier_name VARCHAR(255),
          verifier_type VARCHAR(50) NOT NULL,
          verification_purpose VARCHAR(50) NOT NULL,
          request_token VARCHAR(255) NOT NULL,
          completed BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP,
          expires_at TIMESTAMP NOT NULL,
          response_data JSONB,
          notes TEXT
        );
      `);
      logger.info("Created third_party_verification_requests table");
    }

    // Alter investor_profiles table to add accreditation fields if they don't exist
    const investorProfilesTableExists = await doesTableExist('investor_profiles');
    if (investorProfilesTableExists) {
      // Check if the column exists before adding it
      const accreditationMethodExists = await doesColumnExist('investor_profiles', 'accreditation_method');
      if (!accreditationMethodExists) {
        await db.execute(sql`
          ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS accreditation_method VARCHAR(50);
        `);
        logger.info("Added accreditation_method column to investor_profiles table");
      }

      const netWorthExists = await doesColumnExist('investor_profiles', 'net_worth');
      if (!netWorthExists) {
        await db.execute(sql`
          ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS net_worth NUMERIC;
        `);
        logger.info("Added net_worth column to investor_profiles table");
      }

      const annualIncomeExists = await doesColumnExist('investor_profiles', 'annual_income');
      if (!annualIncomeExists) {
        await db.execute(sql`
          ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS annual_income NUMERIC;
        `);
        logger.info("Added annual_income column to investor_profiles table");
      }

      const jointIncomeExists = await doesColumnExist('investor_profiles', 'joint_income');
      if (!jointIncomeExists) {
        await db.execute(sql`
          ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS joint_income NUMERIC;
        `);
        logger.info("Added joint_income column to investor_profiles table");
      }

      const netWorthVerificationMethodExists = await doesColumnExist('investor_profiles', 'net_worth_verification_method');
      if (!netWorthVerificationMethodExists) {
        await db.execute(sql`
          ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS net_worth_verification_method VARCHAR(50);
        `);
        logger.info("Added net_worth_verification_method column to investor_profiles table");
      }

      const incomeVerificationMethodExists = await doesColumnExist('investor_profiles', 'income_verification_method');
      if (!incomeVerificationMethodExists) {
        await db.execute(sql`
          ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS income_verification_method VARCHAR(50);
        `);
        logger.info("Added income_verification_method column to investor_profiles table");
      }

      const primaryResidenceValueExists = await doesColumnExist('investor_profiles', 'primary_residence_value');
      if (!primaryResidenceValueExists) {
        await db.execute(sql`
          ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS primary_residence_value NUMERIC;
        `);
        logger.info("Added primary_residence_value column to investor_profiles table");
      }

      const professionalLicenseTypeExists = await doesColumnExist('investor_profiles', 'professional_license_type');
      if (!professionalLicenseTypeExists) {
        await db.execute(sql`
          ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS professional_license_type VARCHAR(50);
        `);
        logger.info("Added professional_license_type column to investor_profiles table");
      }

      const professionalLicenseNumberExists = await doesColumnExist('investor_profiles', 'professional_license_number');
      if (!professionalLicenseNumberExists) {
        await db.execute(sql`
          ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS professional_license_number VARCHAR(100);
        `);
        logger.info("Added professional_license_number column to investor_profiles table");
      }

      const currentYearIncomeExpectationExists = await doesColumnExist('investor_profiles', 'current_year_income_expectation');
      if (!currentYearIncomeExpectationExists) {
        await db.execute(sql`
          ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS current_year_income_expectation NUMERIC;
        `);
        logger.info("Added current_year_income_expectation column to investor_profiles table");
      }

      const verificationExpiresAtExists = await doesColumnExist('investor_profiles', 'verification_expires_at');
      if (!verificationExpiresAtExists) {
        await db.execute(sql`
          ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMP;
        `);
        logger.info("Added verification_expires_at column to investor_profiles table");
      }

      const reviewedByExists = await doesColumnExist('investor_profiles', 'reviewed_by');
      if (!reviewedByExists) {
        await db.execute(sql`
          ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES users(id);
        `);
        logger.info("Added reviewed_by column to investor_profiles table");
      }

      const reviewedAtExists = await doesColumnExist('investor_profiles', 'reviewed_at');
      if (!reviewedAtExists) {
        await db.execute(sql`
          ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;
        `);
        logger.info("Added reviewed_at column to investor_profiles table");
      }

      const rejectionReasonExists = await doesColumnExist('investor_profiles', 'rejection_reason');
      if (!rejectionReasonExists) {
        await db.execute(sql`
          ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
        `);
        logger.info("Added rejection_reason column to investor_profiles table");
      }

      const adminNotesExists = await doesColumnExist('investor_profiles', 'admin_notes');
      if (!adminNotesExists) {
        await db.execute(sql`
          ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS admin_notes TEXT;
        `);
        logger.info("Added admin_notes column to investor_profiles table");
      }

      const lastReverificationRequestDateExists = await doesColumnExist('investor_profiles', 'last_reverification_request_date');
      if (!lastReverificationRequestDateExists) {
        await db.execute(sql`
          ALTER TABLE investor_profiles ADD COLUMN IF NOT EXISTS last_reverification_request_date TIMESTAMP;
        `);
        logger.info("Added last_reverification_request_date column to investor_profiles table");
      }
    }

    logger.info("Investor accreditation migration completed successfully");

  } catch (error) {
    logger.error(`Error in investor accreditation migration: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// Helper function to check if a table exists
async function doesTableExist(tableName: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_name = ${tableName}
    );
  `);
  
  return result.rows[0].exists;
}

// Helper function to check if a column exists in a table
async function doesColumnExist(tableName: string, columnName: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public'
      AND table_name = ${tableName}
      AND column_name = ${columnName}
    );
  `);
  
  return result.rows[0].exists;
}