/**
 * This script ensures the server properly restarts using our workflow script
 */

import { execSync, spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';

console.log("Attempting to restart workflow...");

// Kill any existing processes
try {
  // First try to kill any Node.js processes except this one
  const currentPid = process.pid;
  
  try {
    // List all running processes
    const processes = execSync('ps -e').toString().split('\n');
    
    // Find Node.js related processes
    for (const proc of processes) {
      if (proc.includes('node') || proc.includes('tsx') || proc.includes('npm')) {
        const parts = proc.trim().split(/\s+/);
        if (parts.length > 0) {
          const pid = parseInt(parts[0], 10);
          
          // Skip current process
          if (pid && !isNaN(pid) && pid !== currentPid) {
            try {
              console.log(`Killing process ${pid}...`);
              execSync(`kill -9 ${pid}`);
            } catch (e) {
              console.log(`Failed to kill process ${pid}: ${e.message}`);
            }
          }
        }
      }
    }
  } catch (e) {
    console.log(`Error listing processes: ${e.message}`);
  }
  
  // Wait a bit
  await sleep(2000);
  
  // Start our workflow script
  console.log("Starting workflow-start.js...");
  const server = spawn('node', ['workflow-start.js'], {
    stdio: 'inherit',
    detached: true
  });
  
  // Detach the process so it can run independently
  server.unref();
  
  console.log("Workflow restart initiated!");
} catch (error) {
  console.error(`Error restarting workflow: ${error.message}`);
}