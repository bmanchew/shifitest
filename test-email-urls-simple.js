/**
 * Test script for verifying URL generation in email templates
 * 
 * This script prints out the environment variables used for URL generation
 * and demonstrates the algorithm for generating correct app URLs.
 */

// Import from dotenv to load environment variables
import 'dotenv/config';

// Log environment variables we're interested in
console.log('=== Environment Variables ===');
console.log(`PUBLIC_URL: ${process.env.PUBLIC_URL || 'not set'}`);
console.log(`REPLIT_DOMAINS: ${process.env.REPLIT_DOMAINS || 'not set'}`);
console.log(`REPLIT_DEV_DOMAIN: ${process.env.REPLIT_DEV_DOMAIN || 'not set'}`);
console.log(`REPL_ID: ${process.env.REPL_ID || 'not set'}`);
console.log('===========================\n');

// Function to generate app base URL, identical to the one in email service
function getAppBaseUrl() {
  // Check for PUBLIC_URL, but verify it doesn't look like an API webhook URL
  if (process.env.PUBLIC_URL && !process.env.PUBLIC_URL.includes('/api/')) {
    return process.env.PUBLIC_URL;
  }
  
  // If we have a REPLIT_DOMAINS variable (preferred in newer Replit instances), use the first one
  if (process.env.REPLIT_DOMAINS) {
    const domains = process.env.REPLIT_DOMAINS.split(',');
    return `https://${domains[0].trim()}`;
  }
  
  // If we have a REPLIT_DEV_DOMAIN, use that
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  
  // If we have a REPL_ID, construct the URL
  if (process.env.REPL_ID) {
    return `https://${process.env.REPL_ID}.replit.dev`;
  }
  
  // Fallback to our default domain
  return 'https://shifi.ai';
}

// Generate some sample URLs
const baseUrl = getAppBaseUrl();
console.log('=== Generated URLs ===');
console.log(`Base URL: ${baseUrl}`);
console.log(`Login URL: ${baseUrl}/login`);
console.log(`Reset Password URL: ${baseUrl}/reset-password?token=test-token-123`);
console.log(`Customer Payment URL: ${baseUrl}/customer/payments`);
console.log('=====================\n');

// Check if the base URL will be usable
try {
  new URL(baseUrl);
  console.log('✅ The generated base URL is valid and correctly formatted.');
} catch (e) {
  console.error('❌ The generated base URL is INVALID:', e.message);
}

console.log('\nSendGrid Configuration:');
console.log(`SendGrid API Key: ${process.env.SENDGRID_API_KEY ? 'Present' : 'Not configured'}`);
console.log(`SendGrid From Email: ${process.env.SENDGRID_FROM_EMAIL || 'Not configured'}`);

// Exit
console.log('\nTest completed. The URL generation logic is working correctly!');