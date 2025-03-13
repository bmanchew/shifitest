
// Direct database lookup script for phone number
const { storage } = require('./server/storage');

async function lookupPhone(phoneNumber) {
  try {
    console.log(`Looking up information for phone number: ${phoneNumber}`);
    
    // Normalize the phone number
    const normalizedPhone = phoneNumber.replace(/\D/g, '');
    console.log(`Normalized phone number: ${normalizedPhone}`);
    
    // Step 1: Find the user by phone number
    const user = await storage.getUserByPhone(normalizedPhone);
    
    if (!user) {
      console.log(`No user found with phone number ${phoneNumber}`);
      return;
    }
    
    console.log(`\nUser found for phone ${phoneNumber}:`);
    console.log(`User ID: ${user.id}`);
    console.log(`Name: ${user.firstName || ''} ${user.lastName || ''} (${user.name || 'No name'})`);
    console.log(`Email: ${user.email || 'No email'}`);
    console.log(`Role: ${user.role}`);
    
    // Step 2: Find contracts for this user
    const contracts = await storage.getContractsByCustomerId(user.id);
    
    console.log(`\nFound ${contracts.length} contracts for this user:`);
    
    for (const contract of contracts) {
      console.log(`\nContract ID: ${contract.id}`);
      console.log(`Contract Number: ${contract.contractNumber}`);
      console.log(`Status: ${contract.status}`);
      console.log(`Current Step: ${contract.currentStep}`);
      
      // Get application progress for this contract
      const progress = await storage.getApplicationProgressByContractId(contract.id);
      console.log(`\nApplication Progress for contract ${contract.id}:`);
      
      for (const step of progress) {
        console.log(`- Step: ${step.step}, Completed: ${step.completed}`);
      }
    }
    
    // Step 3: Check KYC verifications directly
    const kycVerifications = await storage.getCompletedKycVerificationsByUserId(user.id);
    
    console.log(`\nUser ID ${user.id} has ${kycVerifications.length} completed KYC verification(s):`);
    
    for (const verification of kycVerifications) {
      console.log(`\nVerification for Contract ID: ${verification.contractId}`);
      console.log(`Step: ${verification.step}`);
      console.log(`Completed: ${verification.completed}`);
      console.log(`Completed At: ${verification.completedAt}`);
      
      if (verification.data) {
        try {
          const data = JSON.parse(verification.data);
          console.log(`Verification Data:`, data);
        } catch (e) {
          console.log(`Raw Data: ${verification.data}`);
        }
      }
    }
    
    // Step 4: Check if there are any contracts with this phone number that might not be linked to the user
    const allContracts = await storage.getAllContracts();
    const phoneContracts = allContracts.filter(contract => {
      if (!contract.phoneNumber) return false;
      return contract.phoneNumber.replace(/\D/g, '') === normalizedPhone;
    });
    
    const unlinkedContracts = phoneContracts.filter(contract => contract.customerId !== user.id);
    
    if (unlinkedContracts.length > 0) {
      console.log(`\nWARNING: Found ${unlinkedContracts.length} contracts with this phone number NOT linked to user ID ${user.id}:`);
      
      for (const contract of unlinkedContracts) {
        console.log(`Contract ID: ${contract.id}, Customer ID: ${contract.customerId || 'null'}`);
      }
    }
    
  } catch (error) {
    console.error('Error looking up phone number:', error);
  }
}

// Check the specific phone number
const phoneNumber = '19493223824';
lookupPhone(phoneNumber).catch(console.error);
