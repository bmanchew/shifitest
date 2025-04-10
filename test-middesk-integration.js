import axios from 'axios';
import * as querystring from 'querystring';

// Test data for PRESTIGE MENTORS LLC
const merchantData = {
  legalName: 'PRESTIGE MENTORS LLC',
  contactName: 'Douglas James',
  ein: '99-4902823',
  addressLine1: '1309 Coffeen Ave',
  city: 'Sheridan',
  state: 'WY',
  zipCode: '82801',
  businessStructure: 'LLC',
};

// Function to verify an existing test merchant
async function verifyExistingMerchant() {
  try {
    const merchantId = 60; // Use the merchant ID from setup-test-merchant.js
    
    console.log("\n=== MidDesk Integration Test ===");
    console.log("1. Starting test with existing merchant ID:", merchantId);
    console.log("2. Using merchant data for:", merchantData.legalName);
    
    // Create merchant business details
    console.log("4. Adding business details...");
    const createDetailsResponse = await axios.post('http://localhost:5000/api/merchant-business-details', {
      merchantId: merchantId,
      legalName: merchantData.legalName,
      ein: merchantData.ein,
      addressLine1: merchantData.addressLine1,
      addressLine2: '',
      city: merchantData.city,
      state: merchantData.state,
      zipCode: merchantData.zipCode,
      businessStructure: merchantData.businessStructure,
      phone: '3075551234',
      websiteUrl: 'https://prestigementorsllc.com'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Bypass': 'test-middesk-integration'
      }
    });
    
    if (!createDetailsResponse.data) {
      throw new Error('Failed to create business details - no data received');
    }
    
    if (createDetailsResponse.data.success === false) {
      throw new Error('Failed to create business details: ' + (createDetailsResponse.data.message || 'Unknown error'));
    }
    
    console.log("   Business details created successfully");
    
    // Now submit this business for verification using the endpoint (or get existing verification)
    console.log("5. Submitting business for MidDesk verification...");
    
    let verificationInfo = null;
    
    try {
      const verifyResponse = await axios.post(`http://localhost:5000/api/merchants/${merchantId}/submit-verification`, {}, {
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Bypass': 'test-middesk-integration'
        }
      });
      
      console.log("   Verification submission result:", JSON.stringify(verifyResponse.data, null, 2));
      
      if (verifyResponse.data.success) {
        console.log("\n✅ MidDesk verification successfully initiated");
        console.log("   MidDesk Business ID:", verifyResponse.data.middeskBusinessId);
        console.log("   Verification Status:", verifyResponse.data.verificationStatus);
        verificationInfo = verifyResponse.data;
      } else {
        console.log("\n❌ MidDesk verification failed to initiate");
        console.log("   Error:", verifyResponse.data.message);
      }
    } catch (error) {
      // Check if this is a 400 error because verification already exists
      if (error.response && error.response.status === 400 && error.response.data.middeskBusinessId) {
        console.log("   Verification already exists:", JSON.stringify(error.response.data, null, 2));
        console.log("\n✅ MidDesk verification already exists");
        console.log("   MidDesk Business ID:", error.response.data.middeskBusinessId);
        console.log("   Verification Status:", error.response.data.verificationStatus);
        verificationInfo = error.response.data;
      } else {
        throw error; // Re-throw if it's a different error
      }
    }
    
    // Check the verification status after submission
    const statusResponse = await axios.get(`http://localhost:5000/api/merchants/${merchantId}`, {
      headers: {
        'X-CSRF-Bypass': 'test-middesk-integration'
      }
    });
    
    console.log("\n6. Current merchant record:", statusResponse.data ? "Retrieved" : "Failed");
    if (statusResponse.data) {
      console.log("   Merchant Name:", statusResponse.data.name);
      console.log("   Merchant ID:", statusResponse.data.id);
      
      // Get the business details with verification status
      const detailsResponse = await axios.get(`http://localhost:5000/api/merchant-business-details?merchantId=${merchantId}`, {
        headers: {
          'X-CSRF-Bypass': 'test-middesk-integration'
        }
      });
      
      if (detailsResponse.data && detailsResponse.data.length > 0) {
        const details = detailsResponse.data[0];
        console.log("\n7. Business verification details:");
        console.log("   Legal Name:", details.legalName);
        console.log("   EIN:", details.ein);
        console.log("   MidDesk Business ID:", details.middeskBusinessId);
        console.log("   Verification Status:", details.verificationStatus);
      }
    }
    
    console.log("\n=== Test Complete ===");
    
  } catch (error) {
    console.error("\n❌ Error in MidDesk integration test:", error.message);
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Response:", error.response.data);
    } else if (error.request) {
      console.error("No response received from server");
    }
  }
}

verifyExistingMerchant();