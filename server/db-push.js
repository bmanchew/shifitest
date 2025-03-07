import { exec } from 'child_process';

console.log('Running database migration with drizzle-kit push...');

exec('npm run db:push', (error, stdout, stderr) => {
  if (error) {
    console.error(`Error executing migration: ${error.message}`);
    return;
  }
  
  if (stderr) {
    console.error(`Migration stderr: ${stderr}`);
    return;
  }
  
  console.log(`Migration successful: ${stdout}`);
});