/**
 * Test script for the email URL generation functionality in the server
 */

// Import necessary modules
import express from 'express';
import emailService from './server/services/email.ts';
import 'dotenv/config';

// Create simple Express server for testing
const app = express();
const PORT = 5001;

// Define test endpoint
app.get('/test-email-urls', async (req, res) => {
  const results = {
    environmentVariables: {
      REPL_ID: process.env.REPL_ID || 'not set',
      REPLIT_DOMAINS: process.env.REPLIT_DOMAINS || 'not set',
      PUBLIC_URL: process.env.PUBLIC_URL || 'not set',
      SENDGRID_API_KEY: process.env.SENDGRID_API_KEY ? 'set (hidden)' : 'not set',
      SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL || 'not set'
    },
    urls: {}
  };
  
  // Temporarily replace the sendEmail method to intercept calls and extract URLs
  const originalSendEmail = emailService.sendEmail;
  emailService.sendEmail = (emailData) => {
    // Extract links from HTML
    const links = [];
    if (emailData.html) {
      const linkRegex = /href="([^"]+)"/g;
      let match;
      while ((match = linkRegex.exec(emailData.html)) !== null) {
        links.push(match[1]);
      }
    }
    
    return {
      to: emailData.to,
      subject: emailData.subject,
      links
    };
  };
  
  try {
    // Test sending merchant welcome email
    const welcomeEmail = await emailService.sendMerchantWelcome(
      'test@example.com',
      'Test Merchant',
      'TemporaryPassword123'
    );
    results.urls.merchantWelcome = welcomeEmail.links;
    
    // Test sending password reset email
    const resetEmail = await emailService.sendPasswordReset(
      'test@example.com',
      'Test User',
      'reset-token-123'
    );
    results.urls.passwordReset = resetEmail.links;
    
    // Test sending application received email
    const applicationEmail = await emailService.sendApplicationReceived(
      'test@example.com',
      'Test Customer',
      'Test Merchant'
    );
    results.urls.applicationReceived = applicationEmail.links;
    
    // Restore original method
    emailService.sendEmail = originalSendEmail;
    
    // Send response
    res.json(results);
  } catch (error) {
    // Restore original method in case of error
    emailService.sendEmail = originalSendEmail;
    res.status(500).json({
      error: error.message,
      stack: error.stack
    });
  }
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Email URL test server running at http://0.0.0.0:${PORT}/test-email-urls`);
});