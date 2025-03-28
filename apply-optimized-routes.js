/**
 * This script applies the optimized routes structure to the main application.
 * It replaces the current routes.ts file with our optimized version.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define paths
const ORIGINAL_ROUTES = path.join(__dirname, 'server/routes.ts');
const OPTIMIZED_ROUTES = path.join(__dirname, 'server/routes.optimized.ts');
const BACKUP_ROUTES = path.join(__dirname, 'server/routes.original.ts');

/**
 * Check if a file exists
 */
function fileExists(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch (error) {
    return false;
  }
}

/**
 * Backup the original routes file if it exists
 */
function backupOriginalRoutes() {
  if (fileExists(ORIGINAL_ROUTES)) {
    console.log('📦 Backing up original routes file...');
    fs.copyFileSync(ORIGINAL_ROUTES, BACKUP_ROUTES);
    console.log('✅ Original routes backed up to server/routes.original.ts');
    return true;
  } else {
    console.warn('⚠️ Original routes file not found, cannot create backup');
    return false;
  }
}

/**
 * Replace the current routes file with the optimized version
 */
function applyOptimizedRoutes() {
  if (fileExists(OPTIMIZED_ROUTES)) {
    console.log('🔄 Applying optimized routes...');
    fs.copyFileSync(OPTIMIZED_ROUTES, ORIGINAL_ROUTES);
    console.log('✅ Optimized routes applied successfully');
    return true;
  } else {
    console.error('❌ Optimized routes file not found at server/routes.optimized.ts');
    return false;
  }
}

/**
 * Restore the original routes file from backup
 */
function restoreOriginalRoutes() {
  if (fileExists(BACKUP_ROUTES)) {
    console.log('🔄 Restoring original routes from backup...');
    fs.copyFileSync(BACKUP_ROUTES, ORIGINAL_ROUTES);
    console.log('✅ Original routes restored successfully');
    return true;
  } else {
    console.error('❌ Backup file not found, cannot restore original routes');
    return false;
  }
}

/**
 * Restart the application server
 */
function restartServer() {
  try {
    console.log('🔄 Restarting server...');
    execSync('node restart-workflow.js', { stdio: 'inherit' });
    console.log('✅ Server restart triggered');
    return true;
  } catch (error) {
    console.error('❌ Failed to restart server:', error.message);
    return false;
  }
}

/**
 * Main function to apply changes
 */
function main() {
  console.log('🚀 Starting route optimization process...');
  
  // Check if optimized routes exist
  if (!fileExists(OPTIMIZED_ROUTES)) {
    console.error('❌ Optimized routes file not found. Aborting.');
    process.exit(1);
  }
  
  // Backup original routes
  const backupCreated = backupOriginalRoutes();
  if (!backupCreated) {
    // If original file doesn't exist, we don't need to worry about backup
    console.log('⚠️ Continuing without backup...');
  }
  
  // Apply optimized routes
  const routesApplied = applyOptimizedRoutes();
  if (!routesApplied) {
    console.error('❌ Failed to apply optimized routes. Aborting.');
    process.exit(1);
  }
  
  // Restart the server
  const serverRestarted = restartServer();
  if (!serverRestarted) {
    console.warn('⚠️ Server restart failed. Please restart manually.');
  }
  
  console.log('\n✨ Route optimization complete! ✨');
  console.log('The application now uses the optimized route structure.');
  console.log('If you encounter any issues, you can restore the original routes with:');
  console.log('  node apply-optimized-routes.js --restore');
}

/**
 * Restore function to revert changes
 */
function restore() {
  console.log('🔙 Starting route restoration process...');
  
  // Check if backup exists
  if (!fileExists(BACKUP_ROUTES)) {
    console.error('❌ Backup file not found. Cannot restore.');
    process.exit(1);
  }
  
  // Restore original routes
  const routesRestored = restoreOriginalRoutes();
  if (!routesRestored) {
    console.error('❌ Failed to restore original routes. Aborting.');
    process.exit(1);
  }
  
  // Restart the server
  const serverRestarted = restartServer();
  if (!serverRestarted) {
    console.warn('⚠️ Server restart failed. Please restart manually.');
  }
  
  console.log('\n✨ Route restoration complete! ✨');
  console.log('The application now uses the original route structure.');
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.includes('--restore')) {
  restore();
} else {
  main();
}