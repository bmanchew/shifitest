/**
 * This script frees up port 5000 if needed and then starts the server.
 * It's designed to be used by the Replit workflow to ensure the server can start.
 * If the default port (5000) is unavailable, it attempts to use an alternate port (5001).
 */

import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { setTimeout as sleep } from 'timers/promises';
import net from 'net';

// Get current file directory for imports
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Port configuration
const DEFAULT_PORT = 5000;
const ALTERNATE_PORT = 5001;

/**
 * Checks if a given port is available
 * @param {number} port - The port to check
 * @returns {Promise<boolean>} - True if the port is available, false otherwise
 */
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', () => {
      resolve(false);
    });
    
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    
    server.listen(port);
  });
}

/**
 * Tries to release port 5000
 */
async function freeUpDefaultPort() {
  try {
    console.log(`Attempting to free up port ${DEFAULT_PORT}...`);
    
    // Try to identify any processes using port 5000
    try {
      const output = execSync('pgrep -f "node|tsx" | xargs ps -p').toString();
      console.log('Node processes found:', output);
      
      // Try a few different approaches to kill processes
      try {
        console.log(`Killing any Node.js processes that might be using port ${DEFAULT_PORT}...`);
        const currentPid = process.pid;
        
        // Find Node.js processes and kill them (except the current one)
        const nodeProcesses = execSync('pgrep -f "node|tsx"').toString().trim().split('\n');
        for (const pid of nodeProcesses) {
          if (pid && pid !== String(currentPid)) {
            try {
              console.log(`Attempting to kill process ${pid}...`);
              execSync(`kill -9 ${pid}`);
            } catch (e) {
              console.log(`Failed to kill process ${pid}: ${e.message}`);
            }
          }
        }
      } catch (e) {
        console.log(`Error killing processes: ${e.message}`);
      }
    } catch (e) {
      console.log(`Error finding processes: ${e.message}`);
    }
  } catch (error) {
    console.error(`Error freeing port ${DEFAULT_PORT}:`, error.message);
  }
}

/**
 * Starts the server with the specified port environment variable
 * @param {number} port - The port to use
 */
function startServerWithPort(port) {
  console.log(`Starting the server on port ${port}...`);
  
  // Set the PORT environment variable for the child process
  const env = { ...process.env, PORT: String(port) };
  
  // Use spawn to run the server with tsx
  const server = spawn('npx', ['tsx', 'server/index.ts'], {
    stdio: 'inherit',
    shell: true,
    env
  });
  
  // Handle server process events
  server.on('error', (err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
  
  // Forward exit code when the server exits
  server.on('close', (code) => {
    console.log(`Server process exited with code ${code}`);
    process.exit(code);
  });
  
  // Handle termination signals to gracefully shut down
  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down server...');
    server.kill('SIGINT');
  });
  
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down server...');
    server.kill('SIGTERM');
  });
}

// Main function
async function main() {
  // First try to free up the default port
  await freeUpDefaultPort();
  
  // Wait a moment for ports to be released
  console.log('Waiting for ports to be released...');
  await sleep(3000);
  
  // Check if the default port is available
  const defaultPortAvailable = await isPortAvailable(DEFAULT_PORT);
  
  if (defaultPortAvailable) {
    console.log(`Default port ${DEFAULT_PORT} is available.`);
    startServerWithPort(DEFAULT_PORT);
  } else {
    console.log(`Default port ${DEFAULT_PORT} is not available, trying alternate port ${ALTERNATE_PORT}...`);
    
    // Check if the alternate port is available
    const alternatePortAvailable = await isPortAvailable(ALTERNATE_PORT);
    
    if (alternatePortAvailable) {
      console.log(`Alternate port ${ALTERNATE_PORT} is available.`);
      startServerWithPort(ALTERNATE_PORT);
    } else {
      console.error(`Both default port ${DEFAULT_PORT} and alternate port ${ALTERNATE_PORT} are unavailable.`);
      console.error('Please free up one of these ports and try again.');
      process.exit(1);
    }
  }
}

// Run the main function
main().catch(error => {
  console.error('An error occurred during server startup:', error);
  process.exit(1);
});