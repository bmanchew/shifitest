/**
 * Migration script to create the due_diligence_reports table
 * This migration supports the AI-powered due diligence report functionality
 */
const { Client } = require('pg');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

async function createDueDiligenceReportsTable() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Starting due_diligence_reports table migration...');

    // First check if the table already exists
    const tableCheckResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'due_diligence_reports'
      );
    `);

    if (tableCheckResult.rows[0].exists) {
      console.log('Table due_diligence_reports already exists, skipping creation.');
      return { success: true, message: 'Table already exists' };
    }

    // Check if the enum type exists
    const enumCheckResult = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'due_diligence_report_status'
      );
    `);

    // Create enum if it doesn't exist
    if (!enumCheckResult.rows[0].exists) {
      console.log('Creating due_diligence_report_status enum...');
      await client.query(`
        CREATE TYPE due_diligence_report_status AS ENUM (
          'pending',
          'processing',
          'completed',
          'failed'
        );
      `);
    }

    // Create the table
    console.log('Creating due_diligence_reports table...');
    await client.query(`
      CREATE TABLE due_diligence_reports (
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
  } finally {
    await client.end();
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