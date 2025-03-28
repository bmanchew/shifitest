/**
 * URL Generation Test Script
 * Tests how the email service generates URLs in various environment conditions
 */

// Log environment variables for debugging
console.log('Environment Variables:');
console.log(`REPL_ID: ${process.env.REPL_ID || 'not set'}`);
console.log(`REPLIT_DOMAINS: ${process.env.REPLIT_DOMAINS || 'not set'}`);
console.log(`PUBLIC_URL: ${process.env.PUBLIC_URL || 'not set'}\n`);

function getAppBaseUrl(): string {
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

function testUrlGeneration() {
  const baseUrl = getAppBaseUrl();
  console.log(`Generated base URL: ${baseUrl}`);
  
  const resetPasswordUrl = `${baseUrl}/reset-password?token=test-token-123`;
  console.log(`Reset password URL: ${resetPasswordUrl}`);
  
  const loginUrl = `${baseUrl}/login`;  
  console.log(`Login URL: ${loginUrl}`);
  
  const customerPaymentUrl = `${baseUrl}/customer/payments`;
  console.log(`Customer payment URL: ${customerPaymentUrl}`);
}

// Run the test
testUrlGeneration();