/**
 * Improved port forwarder script that properly forwards the entire HTTP request
 * including headers, body, and properly returns the real response back to the client.
 * 
 * This version is designed for API use and preserves all headers including content-type
 */

import http from 'http';
import { setTimeout as sleep } from 'timers/promises';
import { createServer as createNetServer } from 'net';

const SOURCE_PORT = 5000;
const TARGET_PORT = 5001;
const TARGET_HOST = 'localhost';

console.log(`Starting improved port forwarding from ${SOURCE_PORT} to ${TARGET_HOST}:${TARGET_PORT}...`);

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

// Create a proper HTTP proxy that forwards requests and returns real responses
const server = http.createServer((clientReq, clientRes) => {
  const { headers, method, url } = clientReq;
  
  // Debug output
  console.log(`Forwarding: ${method} ${url}`);
  
  // Create options for the proxy request
  const options = {
    hostname: TARGET_HOST,
    port: TARGET_PORT,
    path: url,
    method,
    headers: {
      ...headers,
      host: `${TARGET_HOST}:${TARGET_PORT}`
    }
  };

  // Create the proxy request
  const proxyReq = http.request(options, (proxyRes) => {
    // Copy all headers from the target response to our client response
    Object.keys(proxyRes.headers).forEach(key => {
      clientRes.setHeader(key, proxyRes.headers[key]);
    });
    
    // Set the status code
    clientRes.writeHead(proxyRes.statusCode);
    
    // Pipe the proxy response directly to our client response
    proxyRes.pipe(clientRes, { end: true });
  });

  // Handle proxy request errors
  proxyReq.on('error', (err) => {
    console.error(`Proxy error: ${err.message}`);
    clientRes.statusCode = 500;
    clientRes.end(`Proxy error: ${err.message}`);
  });

  // Pipe the client request to the proxy request
  clientReq.pipe(proxyReq, { end: true });
});

// Error handler for the server
server.on('error', (err) => {
  console.error(`Port forwarder error: ${err.message}`);
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${SOURCE_PORT} is already in use. Cannot start port forwarder.`);
  }
  process.exit(1);
});

// Check for port availability then start server
async function startServer() {
  try {
    // Check if source port is available
    const isPortAvailable = await checkPort(SOURCE_PORT);
    if (!isPortAvailable) {
      console.error(`Port ${SOURCE_PORT} is already in use. Cannot start port forwarder.`);
      process.exit(1);
    }

    // Start listening
    server.listen(SOURCE_PORT, () => {
      console.log(`Port forwarder running on port ${SOURCE_PORT}, forwarding to ${TARGET_HOST}:${TARGET_PORT}`);
    });

    console.log('Improved port forwarder is running. Press Ctrl+C to stop.');
  } catch (error) {
    console.error('Port forwarder error:', error.message);
    process.exit(1);
  }
}

// Handle termination signals
process.on('SIGINT', () => {
  console.log('Received SIGINT. Shutting down port forwarder...');
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Shutting down port forwarder...');
  server.close();
  process.exit(0);
});

// Start the server
startServer();