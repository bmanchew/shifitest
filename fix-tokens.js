/**
 * This script will fix the JWT token generation in auth.controller.ts
 * by ensuring all tokens include the user's role.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to auth controller file
const authControllerPath = path.join(__dirname, 'server', 'controllers', 'auth.controller.ts');

// Read the file
let content = fs.readFileSync(authControllerPath, 'utf8');

// Replace the JWT token generation with generateToken
content = content.replace(
  /\/\/ Generate JWT token\s+const token = jwt\.sign\(\s+\{ userId: user\.id \},\s+JWT_SECRET,\s+\{ expiresIn: "7d" \}\s+\);/g,
  '// Generate JWT token with role included\n      const token = generateToken(user);'
);

// Update the OTP verification token generation too
content = content.replace(
  /\/\/ Generate JWT token\s+const token = jwt\.sign\(\s+\{ userId: user\.id \},\s+JWT_SECRET,\s+\{ expiresIn: "7d" \}\s+\);/g,
  '// Generate JWT token with role included\n      const token = generateToken(user);'
);

// Update the magic link token generation 
content = content.replace(
  /\/\/ Generate JWT token\s+const jwtToken = jwt\.sign\(\s+\{ userId: user\.id \},\s+JWT_SECRET,\s+\{ expiresIn: "7d" \}\s+\);/g,
  '// Generate JWT token with role included\n      const jwtToken = generateToken(user);'
);

// Save the file
fs.writeFileSync(authControllerPath, content);

console.log('JWT token generation has been updated to include roles');