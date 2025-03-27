#!/usr/bin/env node

/**
 * This script restarts the workflow with our safe server startup script.
 * It will properly terminate any running processes and restart the application.
 */

import { execSync } from 'child_process';
import { spawn } from 'child_process';

console.log('Restarting the server with safe port handling...');

// Kill any existing processes
try {
  console.log('Stopping any running server processes...');
  execSync('pkill -f "tsx server/index.ts" || true');
  execSync('pkill -f "node start-server.js" || true');
  console.log('Waiting for processes to terminate...');
  setTimeout(() => {
    console.log('Starting server with safe port handling...');
    
    // Start our safe server script
    const server = spawn('node', ['start-server.js'], {
      stdio: 'inherit',
      detached: true
    });
    
    // Detach the process so it can run independently
    server.unref();
    
    console.log('Server started in safe mode. Check the console for server logs.');
    process.exit(0);
  }, 2000);
} catch (error) {
  console.error('Error restarting server:', error);
  process.exit(1);
}