/**
 * This script is designed to start the server with our port forwarding solution.
 * It runs two processes:
 * 1. The main server on port 5001
 * 2. A port forwarder on port 5000 that redirects to port 5001
 * 
 * This ensures the workflow system can detect the server on port 5000
 * while the actual server runs on port 5001.
 */

import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';
import net from 'net';

console.log("Starting application with port forwarding...");

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

// Start the main application server
function startServer() {
  console.log("Starting main server...");
  
  // Environment variables for the server
  const env = {
    ...process.env,
    PORT: "5001",
    FORCE_PORT: "true"
  };
  
  // Start the server with PORT=5001
  const server = spawn('tsx', ['server/index.ts'], {
    stdio: 'inherit',
    env,
    shell: true
  });
  
  // Handle server events
  server.on('error', (err) => {
    console.error('Failed to start server:', err);
  });
  
  server.on('close', (code) => {
    console.log(`Server exited with code ${code}`);
    
    // If the server exits, stop the port forwarder too
    if (portForwarderProcess) {
      portForwarderProcess.kill();
    }
    
    process.exit(code);
  });
  
  return server;
}

// Start the port forwarder
function startPortForwarder() {
  console.log("Starting port forwarder...");
  
  // Start the port forwarder script
  const forwarder = spawn('node', ['restart-port-forwarding.js'], {
    stdio: 'inherit',
    shell: true
  });
  
  // Handle forwarder events
  forwarder.on('error', (err) => {
    console.error('Failed to start port forwarder:', err);
  });
  
  forwarder.on('close', (code) => {
    console.log(`Port forwarder exited with code ${code}`);
  });
  
  return forwarder;
}

// Main function
async function main() {
  try {
    // First, check if ports are available
    const port5000Available = await checkPort(5000);
    const port5001Available = await checkPort(5001);
    
    if (!port5000Available) {
      console.log("Port 5000 is not available. Attempting to free it...");
      
      // Try to kill any processes that might be using port 5000
      try {
        const { execSync } = await import('child_process');
        execSync('npx kill-port 5000', { stdio: 'inherit' });
        await sleep(1000);
      } catch (err) {
        console.log("Failed to kill processes on port 5000:", err.message);
      }
    }
    
    if (!port5001Available) {
      console.log("Port 5001 is not available. Attempting to free it...");
      
      // Try to kill any processes that might be using port 5001
      try {
        const { execSync } = await import('child_process');
        execSync('npx kill-port 5001', { stdio: 'inherit' });
        await sleep(1000);
      } catch (err) {
        console.log("Failed to kill processes on port 5001:", err.message);
      }
    }
    
    // Start the server first
    console.log("Starting server on port 5001...");
    const serverProcess = startServer();
    
    // Wait a bit for the server to start
    await sleep(2000);
    
    // Then start the port forwarder
    console.log("Starting port forwarder on port 5000...");
    const portForwarderProcess = startPortForwarder();
    
    // Handle process termination
    process.on('SIGINT', () => {
      console.log('Received SIGINT, shutting down...');
      if (serverProcess) serverProcess.kill('SIGINT');
      if (portForwarderProcess) portForwarderProcess.kill('SIGINT');
    });
    
    process.on('SIGTERM', () => {
      console.log('Received SIGTERM, shutting down...');
      if (serverProcess) serverProcess.kill('SIGTERM');
      if (portForwarderProcess) portForwarderProcess.kill('SIGTERM');
    });
    
    // Keep the process running
    console.log("Application started successfully!");
  } catch (error) {
    console.error("Error starting application:", error);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error('Error in startup script:', error);
  process.exit(1);
});