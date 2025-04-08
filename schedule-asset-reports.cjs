/**
 * This script sets up a regular schedule for generating and checking asset reports
 * It will generate reports for all eligible merchants and check pending reports
 * 
 * Usage: node schedule-asset-reports.cjs
 */

// Import required modules
const cron = require('node-cron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configure schedule (default: run daily at 1:00 AM)
const GENERATE_SCHEDULE = process.env.ASSET_REPORT_GENERATE_SCHEDULE || '0 1 * * *';
// Check status every 4 hours
const CHECK_SCHEDULE = process.env.ASSET_REPORT_CHECK_SCHEDULE || '0 */4 * * *';

// Paths to the scripts
const GENERATE_SCRIPT = path.join(__dirname, 'generate-asset-reports-for-completed-merchants.cjs');
const CHECK_SCRIPT = path.join(__dirname, 'check-asset-reports.js');

// Ensure scripts exist
if (!fs.existsSync(GENERATE_SCRIPT)) {
  console.error(`Error: Script not found: ${GENERATE_SCRIPT}`);
  process.exit(1);
}

if (!fs.existsSync(CHECK_SCRIPT)) {
  console.error(`Error: Script not found: ${CHECK_SCRIPT}`);
  process.exit(1);
}

// Function to run a script and log output
function runScript(scriptPath, taskName) {
  return new Promise((resolve, reject) => {
    console.log(`[${new Date().toISOString()}] Running ${taskName}...`);
    
    // Execute the script
    const process = exec(`node ${scriptPath}`, { maxBuffer: 1024 * 1024 * 10 }); // 10MB buffer
    
    // Create log file streams
    const logDir = path.join(__dirname, 'logs');
    
    // Ensure log directory exists
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const logFile = path.join(logDir, `${taskName.replace(/\s+/g, '-').toLowerCase()}-${timestamp}.log`);
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });
    
    // Write header to log file
    logStream.write(`=== ${taskName} - ${new Date().toISOString()} ===\n\n`);
    
    // Pipe stdout and stderr to log file
    process.stdout.pipe(logStream);
    process.stderr.pipe(logStream);
    
    // Also log to console
    process.stdout.on('data', (data) => {
      console.log(data.toString());
    });
    
    process.stderr.on('data', (data) => {
      console.error(data.toString());
    });
    
    // Handle completion
    process.on('close', (code) => {
      if (code === 0) {
        console.log(`[${new Date().toISOString()}] ${taskName} completed successfully`);
        logStream.end(`\n=== ${taskName} completed with exit code ${code} at ${new Date().toISOString()} ===\n`);
        resolve();
      } else {
        console.error(`[${new Date().toISOString()}] ${taskName} failed with exit code ${code}`);
        logStream.end(`\n=== ${taskName} failed with exit code ${code} at ${new Date().toISOString()} ===\n`);
        reject(new Error(`Script exited with code ${code}`));
      }
    });
    
    process.on('error', (error) => {
      console.error(`[${new Date().toISOString()}] Error executing ${taskName}:`, error);
      logStream.end(`\n=== Error executing ${taskName}: ${error.message} at ${new Date().toISOString()} ===\n`);
      reject(error);
    });
  });
}

// Schedule asset report generation
console.log(`Scheduling asset report generation: ${GENERATE_SCHEDULE}`);
cron.schedule(GENERATE_SCHEDULE, async () => {
  try {
    await runScript(GENERATE_SCRIPT, 'Asset Report Generation');
  } catch (error) {
    console.error('Error in scheduled asset report generation:', error);
  }
});

// Schedule asset report status checks
console.log(`Scheduling asset report status checks: ${CHECK_SCHEDULE}`);
cron.schedule(CHECK_SCHEDULE, async () => {
  try {
    await runScript(CHECK_SCRIPT, 'Asset Report Status Check');
  } catch (error) {
    console.error('Error in scheduled asset report status check:', error);
  }
});

// Run immediately on startup
console.log('Running initial check for pending asset reports...');
runScript(CHECK_SCRIPT, 'Initial Asset Report Status Check')
  .catch(error => {
    console.error('Error in initial asset report status check:', error);
  });

console.log('Asset report scheduler started');
console.log(`Asset reports will be generated at: ${GENERATE_SCHEDULE}`);
console.log(`Asset report status will be checked at: ${CHECK_SCHEDULE}`);
console.log('Press Ctrl+C to exit');

// Keep the process running
process.stdin.resume();