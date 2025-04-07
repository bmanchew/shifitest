/**
 * Migration script to create the due_diligence_reports table
 * This migration supports the AI-powered due diligence report functionality
 */
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create a connection to the database
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

async function createDueDiligenceReportsTable() {
  try {
    console.log('Starting due_diligence_reports table migration...');

    // First create the enum type if it doesn't exist
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'due_diligence_report_status') THEN
          CREATE TYPE due_diligence_report_status AS ENUM (
            'pending',
            'processing',
            'completed',
            'failed'
          );
        END IF;
      END
      $$;
    `);

    // Now create the table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS due_diligence_reports (
        id SERIAL PRIMARY KEY,
        merchant_id INTEGER NOT NULL REFERENCES merchants(id),
        report TEXT NOT NULL,
        generated_at TIMESTAMP DEFAULT NOW(),
        generated_by INTEGER NOT NULL REFERENCES users(id),
        status due_diligence_report_status NOT NULL DEFAULT 'completed',
        risk_score TEXT,
        investment_rating TEXT,
        compliance_status TEXT,
        summary TEXT,
        report_version TEXT DEFAULT '1.0',
        last_reviewed TIMESTAMP,
        last_reviewed_by INTEGER REFERENCES users(id),
        review_notes TEXT,
        archived BOOLEAN DEFAULT false
      );
    `);

    console.log('Due diligence reports table created successfully!');
    return { success: true, message: 'Due diligence reports table created successfully' };
  } catch (error) {
    console.error('Error creating due_diligence_reports table:', error);
    return { success: false, error };
  }
}

// Run the migration
createDueDiligenceReportsTable()
  .then((result) => {
    console.log(result);
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });