/**
 * Test script to verify investor welcome email functionality
 * 
 * This script directly calls the necessary service functions to 
 * simulate the investor registration process without going through the API
 * which would require CSRF token handling.
 */

import { storage } from './server/storage.js';
import emailService from './server/services/email.js';
import crypto from 'crypto';
import bcrypt from 'bcrypt';

async function testInvestorWelcomeEmail() {
  try {
    console.log('Starting investor welcome email test...');
    
    // Generate test data
    const investorEmail = `testinvestor_${Date.now()}@example.com`;
    const investorName = 'Test Investor';
    const temporaryPassword = crypto.randomBytes(8).toString('hex');
    
    console.log(`Test investor: ${investorName} <${investorEmail}>`);
    console.log(`Temporary password: ${temporaryPassword}`);
    
    // Hash the password for storage
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(temporaryPassword, salt);
    
    // Create a test user with investor role
    const nameParts = investorName.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    
    const user = await storage.createUser({
      email: investorEmail,
      firstName,
      lastName,
      name: investorName,
      role: 'investor',
      password: hashedPassword,
      phone: '5555555555'
    });
    
    console.log(`Created investor user with ID: ${user.id}`);
    
    // Create investor profile
    const profile = await storage.createInvestorProfile({
      userId: user.id,
      accreditationStatus: true,
      verificationStatus: 'pending',
      investmentGoals: 'Long-term growth',
      kycCompleted: false,
      documentVerificationCompleted: false
    });
    
    console.log(`Created investor profile with ID: ${profile.id}`);
    
    // Send welcome email
    console.log('Sending welcome email...');
    const emailSent = await emailService.sendInvestorWelcome(
      investorEmail,
      investorName,
      temporaryPassword
    );
    
    console.log(`Welcome email ${emailSent ? 'sent successfully' : 'failed to send'}`);
    
    // Cleanup (optional - uncomment to remove test data)
    // await storage.deleteInvestorProfile(profile.id);
    // await storage.deleteUser(user.id);
    // console.log('Test data cleaned up');
    
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Run the test
testInvestorWelcomeEmail();