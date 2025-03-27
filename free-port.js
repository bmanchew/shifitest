/**
 * This script attempts to free up port 5000 by finding and terminating any processes
 * that might be using it. It's designed to run before starting the application server.
 */

import { execSync } from 'child_process';

// Port to free up
const PORT_TO_FREE = 5000;

try {
  console.log(`Attempting to free up port ${PORT_TO_FREE}...`);
  
  // First, try to identify any processes using port 5000
  // Note: This approach works differently on different operating systems
  
  // Try to use lsof (Linux/Mac)
  try {
    const pids = execSync(`lsof -t -i:${PORT_TO_FREE}`).toString().trim().split('\n');
    if (pids.length > 0 && pids[0] !== '') {
      console.log(`Found process(es) using port ${PORT_TO_FREE}: ${pids.join(', ')}`);
      
      // Kill each process
      for (const pid of pids) {
        try {
          console.log(`Killing process ${pid}...`);
          execSync(`kill -9 ${pid}`);
        } catch (killErr) {
          console.log(`Failed to kill process ${pid}: ${killErr.message}`);
        }
      }
      
      console.log(`Port ${PORT_TO_FREE} should now be available.`);
    } else {
      console.log(`No processes found using port ${PORT_TO_FREE} with lsof.`);
    }
  } catch (lsofErr) {
    console.log(`Could not use lsof command: ${lsofErr.message}`);
    
    // Alternative approach for Windows using netstat
    try {
      const netstatOutput = execSync(`netstat -ano | findstr :${PORT_TO_FREE}`).toString();
      const lines = netstatOutput.split('\n');
      const pids = new Set();
      
      for (const line of lines) {
        if (line.includes(`0.0.0.0:${PORT_TO_FREE}`) || line.includes(`127.0.0.1:${PORT_TO_FREE}`)) {
          const pid = line.trim().split(/\s+/).pop();
          if (pid && !isNaN(pid)) {
            pids.add(pid);
          }
        }
      }
      
      if (pids.size > 0) {
        console.log(`Found process(es) using port ${PORT_TO_FREE}: ${Array.from(pids).join(', ')}`);
        
        // Kill each process
        for (const pid of Array.from(pids)) {
          try {
            console.log(`Killing process ${pid}...`);
            execSync(`taskkill /F /PID ${pid}`);
          } catch (killErr) {
            console.log(`Failed to kill process ${pid}: ${killErr.message}`);
          }
        }
        
        console.log(`Port ${PORT_TO_FREE} should now be available.`);
      } else {
        console.log(`No processes found using port ${PORT_TO_FREE} with netstat.`);
      }
    } catch (netstatErr) {
      // If all else fails, try a generic approach for Node.js processes
      console.log(`Could not use netstat command: ${netstatErr.message}`);
      console.log('Trying to kill Node.js processes that might be using the port...');
      
      try {
        // Try to kill all Node.js processes (except the current one)
        const currentPid = process.pid;
        const output = execSync('ps -e | grep node').toString();
        const nodePids = [];
        
        for (const line of output.split('\n')) {
          const parts = line.trim().split(/\s+/);
          if (parts.length > 0 && !isNaN(parts[0]) && parseInt(parts[0]) !== currentPid) {
            nodePids.push(parts[0]);
          }
        }
        
        if (nodePids.length > 0) {
          console.log(`Found Node.js processes: ${nodePids.join(', ')}`);
          for (const pid of nodePids) {
            try {
              console.log(`Killing Node.js process ${pid}...`);
              execSync(`kill -9 ${pid}`);
            } catch (killErr) {
              console.log(`Failed to kill process ${pid}: ${killErr.message}`);
            }
          }
        } else {
          console.log('No Node.js processes found that could be terminated.');
        }
      } catch (nodeErr) {
        console.log(`Failed to find Node.js processes: ${nodeErr.message}`);
      }
    }
  }
  
  console.log('Port freeing attempt complete.');
} catch (error) {
  console.error(`Error freeing port ${PORT_TO_FREE}:`, error.message);
}