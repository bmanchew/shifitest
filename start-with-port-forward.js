/**
 * This script is a wrapper around npm run dev that sets up port forwarding.
 * It ensures that:
 * 1. The main server runs on port 5001
 * 2. A port forwarder runs on port 5000 redirecting to 5001
 * 
 * This solves the port conflict problem when the main server can't bind to port 5000.
 */

const { spawn } = require('child_process');
const { createServer } = require('http');
const http = require('http');

// Configuration
const MAIN_PORT = 5001;
const FORWARD_PORT = 5000;

// Start the main server on port 5001
function startMainServer() {
  console.log(`Starting main server on port ${MAIN_PORT}...`);
  
  // Set the PORT environment variable for the server process
  const env = { ...process.env, PORT: MAIN_PORT.toString() };
  
  // Start the server using npm run dev (which runs tsx server/index.ts)
  const serverProcess = spawn('tsx', ['server/index.ts'], { 
    stdio: 'inherit',
    env
  });
  
  serverProcess.on('error', (err) => {
    console.error('Failed to start server process:', err);
    process.exit(1);
  });
  
  return serverProcess;
}

// Check if a server is running on the specified port
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = createServer();
    
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false); // Port is in use
      } else {
        resolve(true); // Some other error, assume port is available
      }
    });
    
    server.once('listening', () => {
      server.close();
      resolve(true); // Port is available
    });
    
    server.listen(port);
  });
}

// Check if the main server is running
function isServerRunning(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/health`, (res) => {
      if (res.statusCode === 200) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
    
    req.on('error', () => {
      resolve(false);
    });
    
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Start port forwarding from port 5000 to 5001
function startPortForwarder() {
  console.log(`Starting port forwarder from ${FORWARD_PORT} to ${MAIN_PORT}...`);
  
  const server = createServer((req, res) => {
    const options = {
      hostname: 'localhost',
      port: MAIN_PORT,
      path: req.url,
      method: req.method,
      headers: req.headers
    };
    
    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });
    
    proxyReq.on('error', (err) => {
      console.error('Proxy request error:', err);
      res.statusCode = 500;
      res.end('Proxy error');
    });
    
    req.pipe(proxyReq, { end: true });
  });
  
  server.on('error', (err) => {
    console.error(`Failed to start port forwarder on port ${FORWARD_PORT}:`, err);
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${FORWARD_PORT} is already in use. Unable to start port forwarder.`);
    }
  });
  
  server.listen(FORWARD_PORT, () => {
    console.log(`Port forwarder running on port ${FORWARD_PORT} -> ${MAIN_PORT}`);
    console.log('The application can be accessed at either:');
    console.log(`- http://localhost:${FORWARD_PORT}/`);
    console.log(`- http://localhost:${MAIN_PORT}/`);
  });
  
  return server;
}

// Main function
async function main() {
  console.log('Starting application with port forwarding...');
  
  // Check if port 5000 and 5001 are available
  const port5000Available = await isPortAvailable(FORWARD_PORT);
  const port5001Available = await isPortAvailable(MAIN_PORT);
  
  if (!port5000Available) {
    console.error(`Port ${FORWARD_PORT} is already in use. Will attempt to start server on port ${MAIN_PORT} only.`);
  }
  
  if (!port5001Available) {
    console.error(`Port ${MAIN_PORT} is already in use. Cannot start the server.`);
    process.exit(1);
  }
  
  // Start the main server
  const serverProcess = startMainServer();
  
  // Wait for the server to start
  let serverRunning = false;
  for (let i = 0; i < 30; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    serverRunning = await isServerRunning(MAIN_PORT);
    if (serverRunning) break;
    console.log(`Server doesn't appear to be running on port ${MAIN_PORT}, waiting...`);
  }
  
  if (!serverRunning) {
    console.error(`Server failed to start on port ${MAIN_PORT} after 30 seconds.`);
    serverProcess.kill();
    process.exit(1);
  }
  
  console.log(`Server successfully started on port ${MAIN_PORT}`);
  
  // Start port forwarding if port 5000 is available
  if (port5000Available) {
    const forwarderServer = startPortForwarder();
    
    // Graceful shutdown
    const cleanup = () => {
      console.log('Shutting down...');
      forwarderServer.close();
      serverProcess.kill();
    };
    
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  }
  
  console.log('Application started successfully!');
}

main().catch(err => {
  console.error('Error starting application:', err);
  process.exit(1);
});