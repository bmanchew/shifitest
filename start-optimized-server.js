/**
 * This script starts the server with the optimized route structure
 * It compiles and runs the TypeScript files with the fixed routing
 */

// Import required modules
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Function to check if the port is already in use
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const net = require('net');
    const server = net.createServer();
    
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        resolve(true);
      }
    });
    
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    
    server.listen(port);
  });
}

// Function to find an available port starting from the given one
async function findAvailablePort(startPort) {
  let port = startPort;
  let isAvailable = await isPortAvailable(port);
  
  while (!isAvailable && port < startPort + 10) {
    port++;
    isAvailable = await isPortAvailable(port);
  }
  
  if (!isAvailable) {
    throw new Error(`Could not find an available port between ${startPort} and ${startPort + 10}`);
  }
  
  return port;
}

// Function to compile TypeScript files using Esbuild instead of tsc
async function compileTypeScript() {
  console.log('🔨 Compiling TypeScript files...');
  
  return new Promise((resolve, reject) => {
    const esbuild = spawn('npx', [
      'esbuild', 
      '--bundle', 
      'server/index.optimized.ts', 
      '--platform=node', 
      '--outfile=dist/server.optimized.js',
      '--external:pg-native'
    ], {
      stdio: 'inherit',
      shell: true
    });
    
    esbuild.on('exit', (code) => {
      if (code === 0) {
        console.log('✅ TypeScript compilation successful');
        resolve();
      } else {
        reject(new Error(`Compilation failed with code ${code}`));
      }
    });
  });
}

// Function to start the server
async function startServer(port) {
  console.log(`🚀 Starting server with optimized routes on port ${port}...`);
  
  const serverProcess = spawn('node', ['dist/server.optimized.js'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      PORT: port.toString(),
      DEBUG: 'express:*',
      NODE_ENV: 'development'
    }
  });
  
  // Handle server process exit
  serverProcess.on('exit', (code) => {
    if (code !== 0) {
      console.error(`Server process exited with code ${code}`);
    }
  });
  
  return serverProcess;
}

// Main function
async function main() {
  try {
    // Ensure dist directory exists
    const distDir = path.join(__dirname, 'dist');
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
    }
    
    // Compile TypeScript
    await compileTypeScript();
    
    // Find an available port
    const defaultPort = 5000;
    const port = await findAvailablePort(defaultPort);
    
    if (port !== defaultPort) {
      console.log(`⚠️ Port ${defaultPort} is in use, using port ${port} instead`);
    }
    
    // Start server
    const server = await startServer(port);
    
    // Handle process termination
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down server...');
      server.kill();
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.log('\n🛑 Shutting down server...');
      server.kill();
      process.exit(0);
    });
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the main function
main();