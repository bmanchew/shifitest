/**
 * Test script to verify the email URL generation functionality
 */

const path = require('path');
// Load the email service module using CommonJS require
const emailService = require('./server/services/email').default;

async function testUrls() {
  console.log('Testing email URL generation:');

  // Use reflection to access the private method
  const getAppBaseUrl = emailService.getAppBaseUrl.bind(emailService);
  
  const baseUrl = getAppBaseUrl();
  console.log(`Generated base URL: ${baseUrl}`);
  
  // Simulate different URLs that would be generated
  const resetLink = `${baseUrl}/reset-password?token=test-token`;
  const loginLink = `${baseUrl}/login`;
  const paymentLink = `${baseUrl}/customer/payments`;
  
  console.log(`Reset password link: ${resetLink}`);
  console.log(`Login link: ${loginLink}`);
  console.log(`Payment link: ${paymentLink}`);
}

testUrls().catch(console.error);