import { exec } from 'child_process';
import readline from 'readline';

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('Running Drizzle schema push...');

const drizzlePush = exec('npx drizzle-kit push');

drizzlePush.stdout.on('data', (data) => {
  console.log(data);
  
  // Check if this is a prompt asking to create a new enum
  if (data.includes('Is') && data.includes('enum created or renamed from another enum?')) {
    console.log('Automatically selecting "create enum" option...');
    drizzlePush.stdin.write('\n'); // Select default option (first one, which is create)
  }

  // Check if there's a prompt for any potential data loss
  if (data.includes('This migration includes schema changes that may result in data loss')) {
    console.log('Automatically accepting potential data loss...');
    drizzlePush.stdin.write('y\n');
  }
});

drizzlePush.stderr.on('data', (data) => {
  console.error(`stderr: ${data}`);
});

drizzlePush.on('close', (code) => {
  console.log(`Drizzle push process exited with code ${code}`);
  rl.close();
});