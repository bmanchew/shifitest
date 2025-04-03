/**
 * This script is designed to start the server with our port forwarding solution.
 * It runs two processes:
 * 1. The main server on port 5001
 * 2. A port forwarder on port 5000 that redirects to port 5001
 * 
 * This ensures the workflow system can detect the server on port 5000
 * while the actual server runs on port 5001.
 */

import { spawn, exec } from 'child_process';
import http from 'http';
import net from 'net';

// The port to use for the main server
const MAIN_PORT = 5001;
// The port that the workflow expects (default port)
const EXPECTED_PORT = 5000;

function checkPort(port) {
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

function startServer() {
  console.log(`Starting server on port ${MAIN_PORT}...`);
  const env = {
    ...process.env,
    PORT: MAIN_PORT,
    WS_PORT: MAIN_PORT,
    VITE_PORT: MAIN_PORT
  };
  
  return spawn('npm', ['run', 'dev'], {
    env,
    stdio: 'inherit',
    shell: true
  });
}

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
  });
  
  server.listen(EXPECTED_PORT);
  return server;
}

async function main() {
  // Kill any processes using our ports
  await new Promise((resolve) => {
    exec(`npx kill-port ${MAIN_PORT} ${EXPECTED_PORT}`, () => {
      resolve();
    });
  });
  
  // Give a moment for processes to terminate
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Start the server on MAIN_PORT
  startServer();
  
  // Give the server a moment to start
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Start the port forwarder
  startPortForwarder();
  
  console.log(`Server running at http://localhost:${EXPECTED_PORT}`);
}

// Start the server with port forwarding
main().catch(err => {
  console.error('Error in setup:', err);
});