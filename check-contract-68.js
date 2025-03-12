
/**
 * Script to check contract #68 details
 */
const { storage } = require('./server/storage');

async function checkContract68() {
  try {
    console.log('Checking contract #68 details...');
    
    // Get contract details
    const contract = await storage.getContract(68);
    
    if (!contract) {
      console.log('Contract #68 not found!');
      return;
    }
    
    console.log('Contract data:', contract);
    
    // Get user details if available
    if (contract.customerId) {
      const user = await storage.getUser(contract.customerId);
      if (user) {
        console.log('\nUser connected to contract #68:');
        console.log('- User ID:', user.id);
        console.log('- Name:', user.name);
        console.log('- Phone:', user.phone);
        console.log('- Email:', user.email);
      } else {
        console.log('\nNo user found with ID:', contract.customerId);
      }
    } else {
      console.log('\nNo customer ID associated with contract #68');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the function
checkContract68();
