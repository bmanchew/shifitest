// Script to test KYC verification flow with phone linkage
import { storage } from './server/storage.js';
import { eq } from 'drizzle-orm';
import { contracts } from './shared/schema.js';

async function testKycVerification(userId, phoneNumber) {
  try {
    console.log(`=== Testing KYC verification for user ID: ${userId} with phone number: ${phoneNumber} ===`);
    
    // 1. Get the user information
    const user = await storage.getUser(userId);
    if (!user) {
      console.error(`User ID ${userId} not found`);
      return;
    }
    
    console.log(`\nUser information:`);
    console.log(`  ID: ${user.id}`);
    console.log(`  Name: ${user.firstName} ${user.lastName || ''} (${user.name || 'no legacy name'})`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Phone: ${user.phone || 'none'}`);
    
    // 2. Get all contracts for this user
    const userContracts = await storage.getContractsByCustomerId(userId);
    console.log(`\nFound ${userContracts.length} contracts for user:`);
    
    userContracts.forEach((contract, index) => {
      console.log(`\nContract #${index + 1}:`);
      console.log(`  Contract ID: ${contract.id}`);
      console.log(`  Contract Number: ${contract.contractNumber}`);
      console.log(`  Status: ${contract.status}`);
      console.log(`  Current Step: ${contract.currentStep}`);
      console.log(`  Phone Number: ${contract.phoneNumber || 'none'}`);
    });
    
    // 3. Check phone number linked contracts
    if (phoneNumber) {
      // Normalize phone number by removing non-digits
      const normalizedPhone = phoneNumber.replace(/\D/g, '');
      console.log(`\nChecking for contracts with phone number: ${normalizedPhone}`);
      
      // Find contracts with this phone number
      const phoneContracts = await storage.db
        .select()
        .from(contracts)
        .where(eq(contracts.phoneNumber, normalizedPhone));
        
      console.log(`Found ${phoneContracts.length} contracts with this phone number:`);
      
      if (phoneContracts.length > 0) {
        phoneContracts.forEach((contract, index) => {
          console.log(`\nPhone Contract #${index + 1}:`);
          console.log(`  Contract ID: ${contract.id}`);
          console.log(`  Contract Number: ${contract.contractNumber}`);
          console.log(`  Customer ID: ${contract.customerId}`);
          console.log(`  Status: ${contract.status}`);
          console.log(`  Current Step: ${contract.currentStep}`);
        });
      }
    }
    
    // 4. Get completed KYC verifications for this user
    const kycVerifications = await storage.getCompletedKycVerificationsByUserId(userId);
    
    console.log(`\nUser ID ${userId} has ${kycVerifications.length} KYC verification(s):`);
    
    if (kycVerifications.length > 0) {
      kycVerifications.forEach((verification, index) => {
        console.log(`\nVerification #${index + 1}:`);
        console.log(`  Contract ID: ${verification.contractId}`);
        console.log(`  Step: ${verification.step}`);
        console.log(`  Completed: ${verification.completed}`);
        console.log(`  Created At: ${verification.createdAt}`);
        console.log(`  Completed At: ${verification.completedAt}`);
        
        if (verification.data) {
          try {
            const data = JSON.parse(verification.data);
            console.log(`  Verification Data:`, JSON.stringify(data, null, 2));
          } catch (e) {
            console.log(`  Data: ${verification.data}`);
          }
        }
      });
    }
    
    // 5. Now test creating a new contract with the same phone and check if KYC verification is recognized
    console.log('\n=== Testing KYC recognition with a new contract ===');
    console.log('This would simulate the backend logic for a new contract with the same phone number');
    
    if (phoneNumber) {
      // Create or find a user with this phone number
      console.log(`Finding or creating user by phone: ${phoneNumber}`);
      const phoneUser = await storage.findOrCreateUserByPhone(phoneNumber);
      console.log(`User found/created: ID ${phoneUser.id}, Phone: ${phoneUser.phone}`);
      
      // Check if this user already has KYC verifications
      const phoneUserVerifications = await storage.getCompletedKycVerificationsByUserId(phoneUser.id);
      
      console.log(`User with phone ${phoneNumber} has ${phoneUserVerifications.length} KYC verification(s)`);
      
      if (phoneUserVerifications.length > 0) {
        console.log('KYC verification found for this phone number - user would be recognized as pre-verified!');
      } else {
        console.log('No KYC verification found for this phone number - user would need to complete verification');
      }
    }
    
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Error testing KYC verification:', error);
  }
}

// Test with a specific user ID and phone number
// Replace with real IDs and phone numbers from your database
const userId = 6; // Replace with a real user ID
const phoneNumber = "5555551234"; // Replace with a real phone number

testKycVerification(userId, phoneNumber).catch(console.error);