
// Script to check KYC status for a specific user ID
const { storage } = require('./server/storage');

async function checkUserKycStatus(userId) {
  try {
    console.log(`Checking KYC verification status for user ID: ${userId}`);
    
    // Get completed KYC verifications for this user
    const kycVerifications = await storage.getCompletedKycVerificationsByUserId(userId);
    
    if (kycVerifications.length === 0) {
      console.log(`User ID ${userId} has not completed any KYC verifications.`);
    } else {
      console.log(`User ID ${userId} has completed ${kycVerifications.length} KYC verification(s):`);
      
      kycVerifications.forEach((verification, index) => {
        console.log(`\nVerification #${index + 1}:`);
        console.log(`Contract ID: ${verification.contractId}`);
        console.log(`Step: ${verification.step}`);
        console.log(`Completed: ${verification.completed}`);
        
        if (verification.data) {
          try {
            const data = JSON.parse(verification.data);
            console.log(`Verification Details:`, data);
          } catch (e) {
            console.log(`Data: ${verification.data}`);
          }
        }
      });
    }
  } catch (error) {
    console.error('Error checking KYC status:', error);
  }
}

// Check KYC status for user ID 6
checkUserKycStatus(6).catch(console.error);
