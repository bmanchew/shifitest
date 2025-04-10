/**
 * Script to reload environment variables from .env file
 * 
 * This is useful when you update the .env file and want to make sure
 * the new values are being used.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: '.env' });

// Check required API keys
const DATACRUNCH_URL = process.env.DATACRUNCH_URL;
const DATACRUNCH_API_KEY = process.env.DATACRUNCH_API_KEY;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

console.log('Environment variables loaded from .env:');
console.log('----------------------------------------');
console.log('DATACRUNCH_URL:', DATACRUNCH_URL || 'Not set');
console.log('DATACRUNCH_API_KEY:', DATACRUNCH_API_KEY ? 
  DATACRUNCH_API_KEY.substring(0, 3) + '...' + DATACRUNCH_API_KEY.substring(DATACRUNCH_API_KEY.length - 3) : 
  'Not set');
console.log('HUGGINGFACE_API_KEY:', HUGGINGFACE_API_KEY ? 
  HUGGINGFACE_API_KEY.substring(0, 3) + '...' + HUGGINGFACE_API_KEY.substring(HUGGINGFACE_API_KEY.length - 3) : 
  'Not set');
console.log('----------------------------------------');

// Check for any issues
const issues = [];

if (!DATACRUNCH_URL) {
  issues.push('DATACRUNCH_URL is not set. Use setup-datacrunch-api.js to configure it.');
} else if (!DATACRUNCH_URL.startsWith('http')) {
  issues.push(`DATACRUNCH_URL "${DATACRUNCH_URL}" does not start with http:// or https://`);
}

if (!DATACRUNCH_API_KEY) {
  issues.push('DATACRUNCH_API_KEY is not set. Use setup-datacrunch-api.js to configure it.');
}

if (!HUGGINGFACE_API_KEY) {
  issues.push('HUGGINGFACE_API_KEY is not set. Use setup-datacrunch-api.js to configure it.');
}

if (issues.length > 0) {
  console.log('\nIssues detected:');
  issues.forEach(issue => console.log(' - ' + issue));
  console.log('\nPlease fix these issues before continuing.');
} else {
  console.log('\nAll required environment variables are set correctly.');
  console.log('You can now use test-datacrunch-api.js to test the API integration.');
}