/**
 * This script is a wrapper around npm run dev that sets up port forwarding.
 * It ensures that:
 * 1. The main server runs on port 5001
 * 2. A port forwarder runs on port 5000 redirecting to 5001
 * 
 * This solves the port conflict problem when the main server can't bind to port 5000.
 */

import { spawn, exec } from 'child_process';
import http from 'http';
import net from 'net';

// The port to use for the main server
const MAIN_PORT = 5001;
// The port that the workflow expects (default port)
const EXPECTED_PORT = 5000;

/**
 * Start the main server on MAIN_PORT
 */
function startMainServer() {
  console.log(`Starting main server on port ${MAIN_PORT}...`);
  
  // Set environment variables for the main server
  const env = {
    ...process.env,
    PORT: MAIN_PORT,
    WS_PORT: MAIN_PORT,
    VITE_PORT: MAIN_PORT
  };
  
  // Start the main server with npm run dev
  const server = spawn('npm', ['run', 'dev'], {
    env,
    stdio: 'inherit',
    shell: true
  });
  
  server.on('error', (err) => {
    console.error('Failed to start main server:', err);
    process.exit(1);
  });
  
  return server;
}

/**
 * Check if a port is available
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
 * Check if the server is running on the specified port
 */
function isServerRunning(port) {
  return new Promise((resolve) => {
    const req = http.request({
      method: 'GET',
      host: 'localhost',
      port,
      path: '/',
      timeout: 2000
    }, (res) => {
      resolve(true);
    });
    
    req.on('error', () => {
      resolve(false);
    });
    
    req.end();
  });
}

/**
 * Start the port forwarder to redirect requests from EXPECTED_PORT to MAIN_PORT
 */
function startPortForwarder() {
  console.log(`Starting port forwarder from ${EXPECTED_PORT} to ${MAIN_PORT}...`);
  
  const server = http.createServer((req, res) => {
    const options = {
      hostname: 'localhost',
      port: MAIN_PORT,
      path: req.url,
      method: req.method,
      headers: req.headers
    };
    
    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    
    proxyReq.on('error', (e) => {
      console.error(`Proxy request error: ${e.message}`);
      res.writeHead(502);
      res.end('Bad Gateway');
    });
    
    req.pipe(proxyReq);
  });
  
  server.on('error', (err) => {
    console.error(`Port forwarder error: ${err.message}`);
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${EXPECTED_PORT} is already in use. Please free it up first.`);
      process.exit(1);
    }
  });
  
  server.listen(EXPECTED_PORT);
  console.log(`Port forwarder running on port ${EXPECTED_PORT}`);
  
  return server;
}

/**
 * Main function to start everything
 */
async function main() {
  // First, check if MAIN_PORT is available
  const mainPortAvailable = await isPortAvailable(MAIN_PORT);
  if (!mainPortAvailable) {
    console.error(`Port ${MAIN_PORT} is not available. Killing processes...`);
    exec(`npx kill-port ${MAIN_PORT}`, (error) => {
      if (error) {
        console.error(`Error killing port ${MAIN_PORT}:`, error);
        process.exit(1);
      }
      console.log(`Port ${MAIN_PORT} freed. Restarting...`);
      
      // Restart the script
      setTimeout(() => {
        main();
      }, 1000);
      
      return;
    });
    return;
  }
  
  // Then, check if EXPECTED_PORT is available
  const expectedPortAvailable = await isPortAvailable(EXPECTED_PORT);
  if (!expectedPortAvailable) {
    console.error(`Port ${EXPECTED_PORT} is not available. Killing processes...`);
    exec(`npx kill-port ${EXPECTED_PORT}`, (error) => {
      if (error) {
        console.error(`Error killing port ${EXPECTED_PORT}:`, error);
        process.exit(1);
      }
      console.log(`Port ${EXPECTED_PORT} freed. Restarting...`);
      
      // Restart the script
      setTimeout(() => {
        main();
      }, 1000);
      
      return;
    });
    return;
  }
  
  // Start the main server
  const mainServer = startMainServer();
  
  // Wait for the main server to start
  console.log('Waiting for main server to start...');
  let serverStarted = false;
  for (let i = 0; i < 30; i++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const running = await isServerRunning(MAIN_PORT);
    if (running) {
      serverStarted = true;
      break;
    }
  }
  
  if (!serverStarted) {
    console.error(`Main server did not start within 30 seconds.`);
    process.exit(1);
  }
  
  console.log('Main server started successfully.');
  
  // Start the port forwarder
  const forwarder = startPortForwarder();
  
  // Handle process termination
  process.on('SIGINT', () => {
    console.log('Received SIGINT. Shutting down gracefully...');
    forwarder.close();
    process.exit(0);
  });
}

// Start everything
main().catch(err => {
  console.error('Error in main function:', err);
  process.exit(1);
});