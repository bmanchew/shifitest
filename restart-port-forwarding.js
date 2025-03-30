/**
 * This script serves as a port forwarder to handle the situation where
 * the server needs to run on port 5001 but the workflow expects port 5000.
 * 
 * It creates a simple HTTP server on port 5000 that forwards requests to port 5001.
 */

import http from 'http';
import net from 'net';

console.log("Starting port forwarder from 5000 to 5001...");

// First check if port 5000 is available
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

// Check if port 5001 is in use (this would be our actual server)
async function checkServerRunning() {
  try {
    const response = await fetch('http://localhost:5001/api/health');
    if (response.ok) {
      return true;
    }
  } catch (error) {
    console.log("Server doesn't appear to be running on port 5001");
    return false;
  }
  return false;
}

// Main function
async function main() {
  const port5000Available = await checkPort(5000);
  
  if (!port5000Available) {
    console.error("Port 5000 is already in use, cannot start port forwarder");
    process.exit(1);
  }
  
  const serverRunning = await checkServerRunning();
  
  if (!serverRunning) {
    console.log("Server doesn't appear to be running on port 5001, waiting...");
    // We'll still proceed and the HTTP requests will fail until the server comes up
  }
  
  // Create a simple HTTP server that redirects to port 5001
  const server = http.createServer((req, res) => {
    console.log(`Forwarding request: ${req.method} ${req.url}`);
    
    // Create an options object for the proxied request
    const options = {
      hostname: 'localhost',
      port: 5001,
      path: req.url,
      method: req.method,
      headers: req.headers
    };
    
    // Create a proxy request
    const proxyReq = http.request(options, (proxyRes) => {
      // Copy status code and headers
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      
      // Forward the response body
      proxyRes.pipe(res, { end: true });
    });
    
    // Forward the request body
    req.pipe(proxyReq, { end: true });
    
    // Handle errors
    proxyReq.on('error', (err) => {
      console.error(`Proxy error: ${err.message}`);
      
      // Send a redirect if the server is not responding
      res.writeHead(307, { 
        'Location': `http://${req.headers.host.replace('5000', '5001')}${req.url}`,
        'Content-Type': 'text/html'
      });
      
      res.end(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta http-equiv="refresh" content="2;url=http://${req.headers.host.replace('5000', '5001')}${req.url}">
            <title>Redirecting...</title>
          </head>
          <body>
            <h1>Server is starting...</h1>
            <p>The application is currently starting on port 5001.</p>
            <p>You will be redirected automatically in 2 seconds.</p>
            <p>If you are not redirected, <a href="http://${req.headers.host.replace('5000', '5001')}${req.url}">click here</a>.</p>
          </body>
        </html>
      `);
    });
  });
  
  // Start the server
  server.listen(5000, () => {
    console.log('Port forwarder running on port 5000 -> 5001');
    console.log('The application can be accessed at either:');
    console.log('- http://localhost:5000/');
    console.log('- http://localhost:5001/');
  });
  
  // Handle server errors
  server.on('error', (err) => {
    console.error(`Server error: ${err.message}`);
  });
  
  // Handle process termination
  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down port forwarder...');
    server.close();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down port forwarder...');
    server.close();
    process.exit(0);
  });
}

// Run the main function
main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});