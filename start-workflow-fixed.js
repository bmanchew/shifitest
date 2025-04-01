/**
 * This script is designed to start the server with our port forwarding solution.
 * It runs two processes:
 * 1. The main server on port 5001
 * 2. A port forwarder on port 5000 that redirects to port 5001
 * 
 * This ensures the workflow system can detect the server on port 5000
 * while the actual server runs on port 5001.
 */

import { spawn, execSync } from 'child_process';
import { createServer } from 'net';
import { createServer as createHttpServer } from 'http';
import http from 'http';
import { setTimeout as sleep } from 'timers/promises';

console.log("Starting server with port conflict resolution...");

// Check if a port is available
function checkPort(port) {
  return new Promise((resolve) => {
    const tester = createServer()
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

// Start the actual server on port 5001
function startServer() {
  console.log("Starting main server on port 5001...");
  
  // Use environment variable to ensure the server uses port 5001
  const env = {
    ...process.env,
    PORT: "5001",
    FORCE_PORT: "true" // Custom flag to indicate port should be forced
  };
  
  // Start the server using npm run dev
  const server = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    env,
    shell: true
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
  
  return server;
}

// Start the port forwarder on port 5000
function startPortForwarder() {
  console.log("Starting port forwarder on port 5000 -> 5001...");
  
  // We now import http at the top level, so no need to import it again here
  
  const forwarder = createHttpServer((req, res) => {
    // Log the forwarded request
    console.log(`Forwarding: ${req.method} ${req.url}`);
    
    // Create options for the proxied request
    const options = {
      hostname: 'localhost',
      port: 5001,
      path: req.url,
      method: req.method,
      headers: req.headers
    };
    
    // Create the proxy request
    const proxyReq = http.request(options, (proxyRes) => {
      // Forward the status code and headers
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      
      // Pipe the response data directly
      proxyRes.pipe(res);
    });
    
    // Handle errors in the proxy request
    proxyReq.on('error', (err) => {
      console.error(`Proxy error: ${err.message}`);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: false, 
        message: 'Error connecting to server',
        error: err.message
      }));
    });
    
    // If there's request data, pipe it to the proxied request
    if(req.method !== 'GET' && req.method !== 'HEAD') {
      req.pipe(proxyReq);
    } else {
      proxyReq.end();
    }
  });
  
  // Error handler for the forwarder
  forwarder.on('error', (err) => {
    console.error(`Port forwarder error: ${err.message}`);
  });
  
  // Start listening on port 5000
  forwarder.listen(5000, () => {
    console.log("Port forwarder is listening on port 5000");
  });
  
  return forwarder;
}

// Main function
async function main() {
  try {
    // Kill any existing Node.js processes except this one
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
                console.log(`Terminating existing process ${pid}...`);
                execSync(`kill -9 ${pid}`);
              } catch (e) {
                console.log(`Failed to terminate process ${pid}: ${e.message}`);
              }
            }
          }
        }
      }
    } catch (e) {
      console.log(`Error listing processes: ${e.message}`);
    }
    
    // Wait a bit for processes to terminate
    await sleep(2000);
    
    // Check port 5000 availability
    const port5000Available = await checkPort(5000);
    if (!port5000Available) {
      console.log("WARNING: Port 5000 is still in use. Attempting to proceed anyway.");
    }
    
    // Check port 5001 availability
    const port5001Available = await checkPort(5001);
    if (!port5001Available) {
      console.log("WARNING: Port 5001 is in use. The server may fail to start.");
    }
    
    // Start both the main server and port forwarder
    const server = startServer();
    const forwarder = startPortForwarder();
    
    // Handle termination signals
    process.on('SIGINT', () => {
      console.log('Received SIGINT, shutting down...');
      server.kill('SIGINT');
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.log('Received SIGTERM, shutting down...');
      server.kill('SIGTERM');
      process.exit(0);
    });
    
  } catch (error) {
    console.error("Error starting server:", error.message);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});