
const { pool } = require('./server/db');

async function runPhoneNormalizationMigration() {
  const client = await pool.connect();
  try {
    console.log('Starting phone number normalization migration...');
    const sql = require('fs').readFileSync('migrations/normalize_phone_numbers.sql', 'utf8');
    await client.query(sql);
    console.log('Phone normalization migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    client.release();
    pool.end();
  }
}

runPhoneNormalizationMigration();
