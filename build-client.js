/**
 * This script builds the client and copies the output to the correct location
 * for both development and production environments.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Run the build
console.log('Building client...');
execSync('npm run build', { stdio: 'inherit' });

// Source directory (where Vite builds the client)
const sourceDir = path.resolve(__dirname, 'dist', 'public');

// Copy to server/public for development mode
const serverPublicDir = path.resolve(__dirname, 'server', 'public');
fs.mkdirSync(serverPublicDir, { recursive: true });


// Copy to client/dist for production mode
const clientDistDir = path.resolve(__dirname, 'client', 'dist');
fs.mkdirSync(clientDistDir, { recursive: true });

// Function to copy directory recursively
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Copy files to both directories
console.log('Copying files to server/public...');
copyDir(sourceDir, serverPublicDir);

console.log('Copying files to client/dist...');
copyDir(sourceDir, clientDistDir);

console.log('Build and copy completed successfully!');