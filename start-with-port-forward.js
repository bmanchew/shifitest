/**
 * This script is a wrapper around npm run dev that sets up port forwarding.
 * It ensures that:
 * 1. The main server runs on port 5001
 * 2. A port forwarder runs on port 5000 redirecting to 5001
 * 
 * This solves the port conflict problem when the main server can't bind to port 5000.
 */

import { spawn, execSync } from 'child_process';
import { createServer } from 'net';
import { createServer as createHttpServer } from 'http';
import { setTimeout as sleep } from 'timers/promises';
import http from 'http';

console.log("Starting server with port forwarding...");

// Start the main server on port 5001
function startMainServer() {
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

// Check if a port is available
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = createServer()
      .once('error', () => {
        resolve(false);
      })
      .once('listening', () => {
        server.close();
        resolve(true);
      })
      .listen(port);
  });
}

// Check if server is already running on a port
function isServerRunning(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/health`, (res) => {
      resolve(res.statusCode === 200);
    }).on('error', () => {
      resolve(false);
    });
    
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Start the port forwarder on port 5000
function startPortForwarder() {
  console.log("Starting port forwarder on port 5000 -> 5001...");
  
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
      // List and kill all Node.js processes except this one
      const processes = execSync('ps -e').toString().split('\n');
      
      for (const proc of processes) {
        if (proc.includes('node') || proc.includes('tsx') || proc.includes('npm')) {
          const parts = proc.trim().split(/\s+/);
          if (parts.length > 0) {
            const pid = parseInt(parts[0], 10);
            
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
    
    // Wait for processes to terminate
    await sleep(2000);
    
    // Check port 5000 availability
    const port5000Available = await isPortAvailable(5000);
    
    // Check port 5001 availability
    const port5001Available = await isPortAvailable(5001);
    
    // Check if servers are already running
    const port5000Running = await isServerRunning(5000);
    const port5001Running = await isServerRunning(5001);
    
    console.log(`Port 5000 available: ${port5000Available}, running: ${port5000Running}`);
    console.log(`Port 5001 available: ${port5001Available}, running: ${port5001Running}`);
    
    // If server is already running on port 5001 but not on 5000
    if (port5001Running && !port5000Running && port5000Available) {
      console.log("Server already running on port 5001, starting just the port forwarder");
      startPortForwarder();
      return;
    }
    
    // If both ports are available, start server on 5001 and forwarder on 5000
    if (port5001Available && port5000Available) {
      console.log("Starting server on port 5001 with port forwarding");
      const server = startMainServer();
      startPortForwarder();
      return;
    }
    
    // If port 5001 is running but 5000 is not available
    if (port5001Running && !port5000Available) {
      console.log("WARNING: Server running on port 5001 but port 5000 is not available for forwarding");
      console.log("Manual port forwarding may be required");
      return;
    }
    
    // If port 5001 is not available (but not running)
    if (!port5001Available && !port5001Running) {
      console.log("WARNING: Port 5001 is in use but server is not responding");
      console.log("Attempting to free port 5001...");
      
      try {
        execSync(`lsof -t -i:5001 | xargs kill -9`);
        await sleep(2000);
        
        // Check again
        const port5001AvailableNow = await isPortAvailable(5001);
        if (port5001AvailableNow) {
          console.log("Successfully freed port 5001");
          const server = startMainServer();
          
          // Wait for server to start
          await sleep(5000);
          
          // Check port 5000 again
          const port5000AvailableNow = await isPortAvailable(5000);
          if (port5000AvailableNow) {
            startPortForwarder();
          } else {
            console.log("WARNING: Cannot start port forwarder on port 5000, it's still in use");
          }
          
          return;
        } else {
          console.log("Failed to free port 5001, cannot start server");
          process.exit(1);
        }
      } catch (e) {
        console.log(`Error freeing port 5001: ${e.message}`);
        process.exit(1);
      }
    }
    
    // Last resort: try to start server on different port
    console.log("WARNING: Standard port configuration not available");
    console.log("Attempting to start server on default configuration...");
    
    const server = spawn('npm', ['run', 'dev'], {
      stdio: 'inherit',
      shell: true
    });
    
    server.on('error', (err) => {
      console.error('Failed to start server:', err);
      process.exit(1);
    });
    
    server.on('close', (code) => {
      console.log(`Server process exited with code ${code}`);
      process.exit(code);
    });
    
  } catch (error) {
    console.error("Error starting server:", error.message);
    process.exit(1);
  }
}

// Handle termination signals
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down...');
  process.exit(0);
});

// Run the main function
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});