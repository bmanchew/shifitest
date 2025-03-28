/**
 * This script will update the workflow configuration to use our workflow-start.js
 * which properly handles port 5000 for Replit workflow compatibility
 */

// Import child_process to execute commands
import { execSync } from 'child_process';

// The workflow name
const workflowName = 'Start application';
// The command we want to set
const newCommand = 'node workflow-start.js';

try {
  // Update the workflow
  console.log(`Updating workflow "${workflowName}" to use "${newCommand}"...`);
  
  // Run the command to update the workflow
  // Format is intentionally kept simple as a string template for clarity
  const updateCmd = `echo '{"name":"${workflowName}","command":"${newCommand}"}' | replit workflow set`;
  execSync(updateCmd, { stdio: 'inherit' });
  
  console.log(`Workflow "${workflowName}" updated successfully!`);
  console.log('Please restart the workflow manually or reinitialize the repl for changes to take effect.');
} catch (error) {
  console.error(`Error updating workflow: ${error.message}`);
}