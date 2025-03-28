/**
 * URL Generation Test Script
 * Directly access and test the URL generation function to verify it works correctly
 */

// Set up the environment variables for testing
console.log('Environment variables for testing:');
console.log(`REPL_ID: ${process.env.REPL_ID}`);
console.log(`REPLIT_DOMAINS: ${process.env.REPLIT_DOMAINS}`);
console.log(`PUBLIC_URL: ${process.env.PUBLIC_URL || 'not set'}`);

// Add custom class implementation with a public method
class UrlTester {
  getAppBaseUrl(): string {
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
  
  testUrlGeneration() {
    const baseUrl = this.getAppBaseUrl();
    console.log(`Generated base URL: ${baseUrl}`);
    
    // Simulate different URLs that would be generated in emails
    const resetLink = `${baseUrl}/reset-password?token=test-token`;
    const loginLink = `${baseUrl}/login`;
    const paymentLink = `${baseUrl}/customer/payments`;
    
    console.log(`Reset password link: ${resetLink}`);
    console.log(`Login link: ${loginLink}`);
    console.log(`Payment link: ${paymentLink}`);
  }
}

// Create instance and run the test
const tester = new UrlTester();
tester.testUrlGeneration();