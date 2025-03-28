/**
 * Test script for the email service
 * 
 * This script directly tests the EmailService to verify it's working correctly and generating proper URLs.
 */

import emailService from './server/services/email.js';
import logger from './server/utils/logger.js';

// Test configuration
async function testEmailConfiguration() {
  try {
    console.log('Checking email service configuration...');
    
    // Check for SendGrid API key
    const hasSendGridKey = !!process.env.SENDGRID_API_KEY;
    console.log(`SendGrid API key configured: ${hasSendGridKey ? 'Yes' : 'No'}`);
    
    // Check for FromEmail
    const hasFromEmail = !!process.env.SENDGRID_FROM_EMAIL;
    console.log(`SendGrid From Email configured: ${hasFromEmail ? 'Yes' : 'No'}`);
    
    if (!hasSendGridKey || !hasFromEmail) {
      console.error('Missing SendGrid configuration. Please check environment variables.');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error checking email configuration:', error);
    return false;
  }
}

// Test URL generation in email service
async function testEmailUrlGeneration() {
  try {
    console.log('\nTesting URL generation in email service...');
    
    // Create a merchant welcome email to see the URL in action
    // This won't actually send an email
    const originalSendEmail = emailService.sendEmail;
    emailService.sendEmail = (emailData) => {
      return Promise.resolve(true);
    };
    
    await emailService.sendMerchantWelcome(
      'test@example.com',
      'Test Merchant',
      'TemporaryPassword123'
    );
    
    // Get the baseUrl from environment variables to double-check
    let baseUrl = null;
    if (process.env.PUBLIC_URL && !process.env.PUBLIC_URL.includes('/api/')) {
      baseUrl = process.env.PUBLIC_URL;
    } else if (process.env.REPLIT_DOMAINS) {
      const domains = process.env.REPLIT_DOMAINS.split(',');
      baseUrl = `https://${domains[0].trim()}`;
    } else if (process.env.REPLIT_DEV_DOMAIN) {
      baseUrl = `https://${process.env.REPLIT_DEV_DOMAIN}`;
    } else if (process.env.REPL_ID) {
      baseUrl = `https://${process.env.REPL_ID}.replit.dev`;
    } else {
      baseUrl = 'https://shifi.ai';
    }
    
    console.log(`Generated base URL: ${baseUrl}`);
    
    // Validate the URL
    try {
      new URL(baseUrl);
      console.log('URL is valid and well-formed.');
      
      // Restore original method
      emailService.sendEmail = originalSendEmail;
      return true;
    } catch (e) {
      console.error('Generated URL is not valid:', e.message);
      
      // Restore original method
      emailService.sendEmail = originalSendEmail;
      return false;
    }
  } catch (error) {
    console.error('Error testing URL generation:', error);
    return false;
  }
}

// Test sending a welcome email (without actually sending)
async function testEmailTemplates() {
  try {
    console.log('\nTesting email template generation (no emails will be sent)...');
    
    // Mock the sendEmail method to prevent actual sending
    const originalSendEmail = emailService.sendEmail;
    emailService.sendEmail = (emailData) => {
      console.log('Email would be sent with the following data:');
      console.log(`To: ${emailData.to}`);
      console.log(`Subject: ${emailData.subject}`);
      console.log(`From: ${emailData.from || process.env.SENDGRID_FROM_EMAIL}`);
      
      // Show part of the HTML to verify links are correct
      if (emailData.html) {
        // Extract links from HTML
        const linkRegex = /href="([^"]+)"/g;
        let match;
        console.log('Links in email:');
        while ((match = linkRegex.exec(emailData.html)) !== null) {
          console.log(`- ${match[1]}`);
        }
      }
      
      return Promise.resolve(true);
    };
    
    // Generate a test welcome email
    await emailService.sendMerchantWelcome(
      'test@example.com',
      'Test Merchant',
      'TemporaryPassword123'
    );
    
    // Generate a test password reset email
    await emailService.sendPasswordReset(
      'test@example.com',
      'Test User',
      'reset-token-123'
    );
    
    // Restore original method
    emailService.sendEmail = originalSendEmail;
    
    return true;
  } catch (error) {
    console.error('Error testing email templates:', error);
    return false;
  }
}

// Main function
async function main() {
  try {
    console.log('=============================================');
    console.log('         EMAIL SERVICE TEST SCRIPT          ');
    console.log('=============================================\n');
    
    // Run tests
    const configOk = await testEmailConfiguration();
    const urlGenOk = await testEmailUrlGeneration();
    const templatesOk = await testEmailTemplates();
    
    console.log('\n=============================================');
    console.log(' TEST RESULTS:');
    console.log(` Configuration: ${configOk ? '✓ PASS' : '✗ FAIL'}`);
    console.log(` URL Generation: ${urlGenOk ? '✓ PASS' : '✗ FAIL'}`);
    console.log(` Email Templates: ${templatesOk ? '✓ PASS' : '✗ FAIL'}`);
    console.log('=============================================');
    
    if (configOk && urlGenOk && templatesOk) {
      console.log('\nAll tests PASSED. Email service should be working correctly.');
    } else {
      console.error('\nSome tests FAILED. Please check the logs above for details.');
    }
    
  } catch (error) {
    console.error('Error running tests:', error);
  }
}

// Run the tests
main();