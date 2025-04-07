/**
 * This script runs the migration to create the due_diligence_reports table
 */

import { execSync } from 'child_process';

try {
  console.log('Running due diligence reports table migration...');
  execSync('node migrations/create_due_diligence_reports.js', { stdio: 'inherit' });
  console.log('Migration completed successfully!');
} catch (error) {
  console.error('Error running migration:', error);
  process.exit(1);
}