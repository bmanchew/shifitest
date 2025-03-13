
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
const { exec } = require('child_process');
const path = require('path');

console.log('Running phone number normalization migration...');

const migrationPath = path.join(__dirname, 'migrations', 'normalize_phone_numbers.sql');
const command = `psql $DATABASE_URL -f ${migrationPath}`;

exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error executing migration: ${error.message}`);
    return;
  }
  
  if (stderr) {
    console.error(`Migration stderr: ${stderr}`);
  }
  
  console.log(`Migration stdout: ${stdout}`);
  console.log('Phone number normalization completed successfully!');
});
