/**
 * This script updates the Replit workflow to use our improved startup process.
 * It modifies package.json to create a new script that calls our port-aware startup code.
 */

import { readFileSync, writeFileSync } from 'fs';

console.log("Updating application workflow for better startup stability...");

try {
  // Read the current package.json
  const packageJsonPath = './package.json';
  const packageJsonContent = readFileSync(packageJsonPath, 'utf8');
  const packageJson = JSON.parse(packageJsonContent);
  
  // Add our new startup script
  if (!packageJson.scripts.start_safe) {
    console.log("Adding 'start_safe' script to package.json");
    
    packageJson.scripts.start_safe = "node workflow-start.js";
    
    // Write the updated package.json
    writeFileSync(
      packageJsonPath, 
      JSON.stringify(packageJson, null, 2),
      'utf8'
    );
    
    console.log("Successfully updated package.json with 'start_safe' script");
  } else {
    console.log("'start_safe' script already exists in package.json");
  }
  
  console.log("\nTo start the application with improved port handling:");
  console.log("1. Run 'npm run start_safe' instead of 'npm run dev'");
  console.log("2. The script will automatically handle port conflicts");
  console.log("3. If port 5000 is unavailable, it will set up port forwarding");
  
} catch (error) {
  console.error("Failed to update workflow:", error.message);
}