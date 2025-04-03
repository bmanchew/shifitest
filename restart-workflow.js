/**
 * This script ensures the server properly restarts using our workflow script
 */

import { exec } from 'child_process';

console.log("Killing any processes on port 5000 and 5001...");
exec('npx kill-port 5000 5001', (error) => {
  if (error) {
    console.error("Error killing processes:", error);
  } else {
    console.log("Ports freed successfully!");
  }
  
  console.log("Starting server with port forwarding solution...");
  exec('node start-workflow-fixed.js', (error, stdout, stderr) => {
    if (error) {
      console.error("Error starting server:", error);
      return;
    }
    
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
  });
});