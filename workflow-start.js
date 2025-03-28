/**
 * This script is designed to handle the Replit workflow start process.
 * It ensures that port 5000 is available and then starts the application.
 */

import { execSync, spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';
import net from 'net';
import http from 'http';

console.log("Starting workflow preparation...");

// More aggressive approach to free port 5000
async function freePort() {
  try {
    console.log("Attempting to free port 5000...");
    
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
    
    // Wait for ports to be released
    await sleep(3000);
    
    // Double-check port 5000 is free
    const isPortFree = await checkPort(5000);
    if (!isPortFree) {
      console.log("Port 5000 is still in use after process termination attempts");
      
      // Try to handle port forwarding by creating a proxy
      await setupPortForward();
    } else {
      console.log("Port 5000 is now free!");
    }
  } catch (error) {
    console.error("Error freeing ports:", error.message);
  }
}

// Check if a port is available
function checkPort(port) {
  return new Promise((resolve) => {
    const tester = net.createServer()
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

// Setup port forwarding from 5000 to another available port
async function setupPortForward() {
  // Find an available port to use
  let availablePort = null;
  
  for (let port = 5001; port < 5100; port++) {
    if (await checkPort(port)) {
      availablePort = port;
      break;
    }
  }
  
  if (!availablePort) {
    console.error("Could not find any available port for proxying!");
    return;
  }
  
  console.log(`Setting up port forwarding from 5000 to ${availablePort}`);
  
  // Create an HTTP server on port 5000
  const proxyServer = http.createServer((req, res) => {
    console.log(`Proxying ${req.method} ${req.url} from port 5000 to port ${availablePort}`);
    
    const options = {
      hostname: 'localhost',
      port: availablePort,
      path: req.url,
      method: req.method,
      headers: req.headers
    };
    
    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });
    
    req.pipe(proxyReq, { end: true });
    
    proxyReq.on('error', (err) => {
      console.error('Proxy request error:', err);
      res.statusCode = 500;
      res.end('Proxy error');
    });
  });
  
  // Try to start the proxy
  try {
    proxyServer.listen(5000, () => {
      console.log(`Proxy server listening on port 5000, forwarding to ${availablePort}`);
    });
    
    // Handle proxy server errors
    proxyServer.on('error', (err) => {
      console.error(`Proxy server error: ${err.message}`);
    });
    
    // Now start the actual application on the available port
    startServer(availablePort.toString());
  } catch (err) {
    console.error(`Failed to start proxy server: ${err.message}`);
    // Still try to start the server on the available port
    startServer(availablePort.toString());
  }
}

// Start the server with PORT environment variable explicitly set
async function startServer(port = "5000") {
  console.log(`Starting server with PORT=${port}...`);
  
  // Use environment variable to ensure the specified port is used
  const env = {
    ...process.env,
    PORT: port,
    FORCE_PORT: "true" // Custom flag to indicate port should be forced
  };
  
  // Start the server using tsx for TypeScript execution
  const server = spawn('npx', ['tsx', 'server/index.ts'], {
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
  
  // Handle termination signals
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
  await freePort();
  await startServer();
}

// Run the main function
main().catch(error => {
  console.error('Error in workflow start script:', error);
  process.exit(1);
});