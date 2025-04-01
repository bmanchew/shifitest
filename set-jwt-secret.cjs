/**
 * This script updates the server process environment with a JWT_SECRET
 * for development use. This ensures authentication works properly.
 */
const fs = require('fs');
const path = require('path');

// Read the .env file if it exists
let envContent = {};
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
      if (line.trim() && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=').trim().replace(/^["'](.*)["']$/, '$1');
        if (key.trim()) {
          envContent[key.trim()] = value;
        }
      }
    });
  }
} catch (error) {
  console.error('Error reading .env file:', error);
}

// Check if JWT_SECRET exists in environment or .env
if (!process.env.JWT_SECRET && !envContent.JWT_SECRET) {
  // No JWT_SECRET found, create one
  const jwtSecret = "shifi-secure-jwt-secret-for-development-only";
  
  // Set it in the current process environment
  process.env.JWT_SECRET = jwtSecret;
  
  // Add it to the .env file if possible
  try {
    const envPath = path.join(__dirname, '.env');
    let content = '';
    
    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, 'utf8');
      if (!content.includes('JWT_SECRET=')) {
        content += '\n# Authentication - JWT Secret for token generation/validation\nJWT_SECRET="' + jwtSecret + '"\n';
      }
    } else {
      content = '# Authentication - JWT Secret for token generation/validation\nJWT_SECRET="' + jwtSecret + '"\n';
    }
    
    fs.writeFileSync(envPath, content);
    console.log(`JWT_SECRET has been set to: ${jwtSecret}`);
    console.log('Added JWT_SECRET to .env file');
  } catch (error) {
    console.error('Error updating .env file:', error);
    console.log(`JWT_SECRET has been set in memory to: ${jwtSecret}`);
  }
} else {
  // JWT_SECRET exists
  const jwtSecret = process.env.JWT_SECRET || envContent.JWT_SECRET;
  console.log(`JWT_SECRET is already set to: ${jwtSecret}`);
}

// Export the jwt secret for use in requiring modules
module.exports = {
  JWT_SECRET: process.env.JWT_SECRET
};