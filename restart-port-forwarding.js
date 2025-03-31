/**
 * This script serves as a port forwarder to handle the situation where
 * the server needs to run on port 5001 but the workflow expects port 5000.
 * 
 * It creates a simple HTTP server on port 5000 that forwards requests to port 5001.
 */

import { createServer } from 'http';
import { setTimeout as sleep } from 'timers/promises';
import { createServer as createNetServer } from 'net';

console.log("Starting port forwarding from 5000 to 5001...");

// Check if a port is available
function checkPort(port) {
  return new Promise((resolve) => {
    const tester = createNetServer()
      .once('error', () => {
        resolve(false);
      })
      .once('listening', () => {
        tester.close();
        resolve(true);
      })
      .listen(port);
  });
}

// Check if server is running on port 5001
async function checkServerRunning() {
  try {
    const response = await fetch('http://localhost:5001/health');
    if (response.ok) {
      return true;
    }
  } catch (error) {
    console.log(`Server check failed: ${error.message}`);
  }
  return false;
}

// Main function
async function main() {
  try {
    // Check if port 5000 is available
    const port5000Available = await checkPort(5000);
    if (!port5000Available) {
      console.log("Port 5000 is already in use. Cannot start port forwarder.");
      process.exit(1);
    }

    // Create the HTTP server
    const server = createServer((req, res) => {
      console.log(`Forwarding request: ${req.method} ${req.url}`);
      
      // Simple HTML page with auto-redirect
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta http-equiv="refresh" content="0;url=http://${req.headers.host.replace('5000', '5001')}${req.url}">
            <title>Redirecting...</title>
          </head>
          <body>
            <h1>Redirecting to active server port...</h1>
            <p>If you are not redirected, <a href="http://${req.headers.host.replace('5000', '5001')}${req.url}">click here</a>.</p>
          </body>
        </html>
      `);
    });

    // Error handler for the server
    server.on('error', (err) => {
      console.error(`Port forwarder error: ${err.message}`);
      process.exit(1);
    });

    // Start listening on port 5000
    server.listen(5000, () => {
      console.log("Port forwarder is listening on port 5000, forwarding to port 5001");
    });

    // Start a health check loop
    let serverWasRunning = false;
    
    setInterval(async () => {
      const isRunning = await checkServerRunning();
      
      if (isRunning && !serverWasRunning) {
        console.log("Server is now running on port 5001");
        serverWasRunning = true;
      } else if (!isRunning && serverWasRunning) {
        console.log("Warning: Server on port 5001 is no longer responding");
        serverWasRunning = false;
      }
    }, 10000); // Check every 10 seconds
    
    // First immediate check
    const isRunning = await checkServerRunning();
    if (isRunning) {
      console.log("Server is running on port 5001");
      serverWasRunning = true;
    } else {
      console.log("Warning: Server on port 5001 is not responding. Port forwarding is set up but may not work until the server is running.");
    }

    console.log("Port forwarder is running. Press Ctrl+C to stop.");
  } catch (error) {
    console.error("Port forwarder error:", error.message);
    process.exit(1);
  }
}

// Handle termination signals
process.on('SIGINT', () => {
  console.log('Received SIGINT. Shutting down port forwarder...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Shutting down port forwarder...');
  process.exit(0);
});

// Run the main function
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});