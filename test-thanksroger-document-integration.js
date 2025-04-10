/**
 * Test script for Thanks Roger document integration
 * 
 * This script tests the document retrieval flow by:
 * 1. Authenticating as an admin
 * 2. Simulating a document signing event
 * 3. Checking the database for stored document URLs
 * 4. Verifying document accessibility
 */

const axios = require('axios');
const fs = require('fs');
const { URL } = require('url');
const path = require('path');
const { db } = require('./server/db');
const { contracts, applicationProgress } = require('./shared/schema');
const { eq, and, isNotNull } = require('drizzle-orm');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@shilohfinance.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password';
const THANKSROGER_API_KEY = process.env.THANKS_ROGER_API_KEY || process.env.THANKSROGER_API_KEY;

// Store cookies for authenticated requests
let cookies = [];

// Initialize axios instance with cookie handling
const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true
});

// Add response interceptor to save cookies
api.interceptors.response.use(response => {
  const setCookieHeader = response.headers['set-cookie'];
  if (setCookieHeader) {
    cookies = setCookieHeader;
  }
  return response;
});

// Add request interceptor to include cookies
api.interceptors.request.use(config => {
  if (cookies.length > 0) {
    config.headers.Cookie = cookies.join('; ');
  }
  return config;
});

/**
 * Login as admin
 */
async function loginAsAdmin() {
  console.log('🔑 Authenticating as admin...');
  try {
    // Get CSRF token
    const csrfResponse = await api.get('/api/auth/csrf');
    const csrfToken = csrfResponse.data.csrfToken;

    // Login with credentials
    const loginResponse = await api.post('/api/auth/login', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      _csrf: csrfToken
    });

    if (loginResponse.data.success) {
      console.log('✅ Authentication successful');
      return true;
    } else {
      console.error('❌ Authentication failed:', loginResponse.data.message);
      return false;
    }
  } catch (error) {
    console.error('❌ Authentication error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    return false;
  }
}

/**
 * Get CSRF token for authenticated requests
 */
async function getCsrfToken() {
  try {
    const response = await api.get('/api/auth/csrf');
    return response.data.csrfToken;
  } catch (error) {
    console.error('❌ Error getting CSRF token:', error.message);
    throw error;
  }
}

/**
 * Simulate a document signing event by creating test data
 */
async function simulateDocumentSigning() {
  console.log('📝 Simulating document signing...');
  
  try {
    // Get a recent contract to use for testing
    const recentContracts = await db.select({
      id: contracts.id,
      merchantId: contracts.merchantId,
      customerId: contracts.customerId,
      contractNumber: contracts.contractNumber
    })
    .from(contracts)
    .where(
      contracts.status.in(['pending', 'active'])
    )
    .orderBy(contracts.id)
    .limit(1);

    if (recentContracts.length === 0) {
      console.log('❌ No contracts found to test with');
      return null;
    }

    const contract = recentContracts[0];
    console.log(`Found contract #${contract.contractNumber} (ID: ${contract.id})`);

    // Create a mock document URL (normally from Thanks Roger)
    // In a real integration, this would come from the Thanks Roger API
    const mockDocumentUrl = `https://api.thanksroger.com/view/doc-${Date.now()}.pdf`;
    const mockSignatureId = `sig-${Date.now()}`;
    const mockDocumentId = `doc-${Date.now()}`;

    // Update the contract with mock external document data
    await db
      .update(contracts)
      .set({
        status: 'signed',
        signedAt: new Date(),
        externalDocumentId: mockDocumentId,
        externalSignatureId: mockSignatureId
      })
      .where(eq(contracts.id, contract.id));

    // Create an application progress record with the document URL
    const progressData = {
      step: 'signing',
      completed: true,
      contractId: contract.id,
      data: JSON.stringify({
        documentUrl: mockDocumentUrl,
        signatureId: mockSignatureId,
        status: 'completed'
      }),
      completedAt: new Date()
    };

    await db.insert(applicationProgress).values(progressData);

    console.log(`✅ Mock document URL created: ${mockDocumentUrl}`);
    
    return {
      contractId: contract.id,
      contractNumber: contract.contractNumber,
      documentUrl: mockDocumentUrl,
      signatureId: mockSignatureId,
      documentId: mockDocumentId
    };
  } catch (error) {
    console.error('❌ Error simulating document signing:', error.message);
    return null;
  }
}

/**
 * Verify the document retrieval API endpoint
 */
async function verifyDocumentRetrieval() {
  console.log('🔍 Testing document retrieval API...');
  
  try {
    const response = await api.get('/api/admin/thanksroger-test/documents');
    
    if (response.data.success) {
      console.log(`✅ Retrieved ${response.data.documents.length} documents`);
      return response.data.documents;
    } else {
      console.error('❌ Failed to retrieve documents:', response.data.message);
      return [];
    }
  } catch (error) {
    console.error('❌ Error retrieving documents:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    return [];
  }
}

/**
 * Test document URL verification
 */
async function verifyDocumentUrl(contractId) {
  console.log(`🔍 Verifying document URL for contract ID ${contractId}...`);
  
  try {
    const response = await api.get(`/api/admin/thanksroger-test/verify-document/${contractId}`);
    
    if (response.data.success) {
      console.log('✅ Document URL verification result:');
      console.log(`  - Accessible: ${response.data.accessible}`);
      console.log(`  - Content Type: ${response.data.contentType || 'Unknown'}`);
      console.log(`  - URL: ${response.data.documentUrl}`);
      return true;
    } else {
      console.error('❌ Document URL verification failed:', response.data.message);
      return false;
    }
  } catch (error) {
    console.error('❌ Error verifying document URL:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    return false;
  }
}

/**
 * Check if Thanks Roger API key is available
 */
function checkApiKeyAvailability() {
  if (!THANKSROGER_API_KEY) {
    console.warn('⚠️ No Thanks Roger API key found in environment variables');
    console.warn('⚠️ Set THANKS_ROGER_API_KEY or THANKSROGER_API_KEY for full integration testing');
    return false;
  }
  console.log('✅ Thanks Roger API key found in environment');
  return true;
}

/**
 * Main test function
 */
async function main() {
  console.log('🚀 Starting Thanks Roger document integration test');
  console.log('================================================');
  
  // Check API key availability
  checkApiKeyAvailability();
  
  // Login as admin
  const loggedIn = await loginAsAdmin();
  if (!loggedIn) {
    console.error('❌ Test aborted due to authentication failure');
    process.exit(1);
  }
  
  // First check if there are already documents in the system
  const existingDocuments = await verifyDocumentRetrieval();
  let documentToVerify = null;
  
  if (existingDocuments.length > 0) {
    console.log('✅ Found existing documents to test with');
    documentToVerify = existingDocuments[0];
  } else {
    console.log('⚠️ No existing documents found, simulating document signing...');
    
    // Simulate document signing to create test data
    const signedDocument = await simulateDocumentSigning();
    if (!signedDocument) {
      console.error('❌ Test aborted due to failure in document simulation');
      process.exit(1);
    }
    
    // Retrieve documents again to verify our simulation worked
    const updatedDocuments = await verifyDocumentRetrieval();
    
    if (updatedDocuments.length > 0) {
      documentToVerify = updatedDocuments.find(doc => 
        doc.contractId === signedDocument.contractId
      );
    }
  }
  
  // Verify a document URL if we have one
  if (documentToVerify) {
    console.log(`Testing verification for contract ID ${documentToVerify.id}`);
    await verifyDocumentUrl(documentToVerify.id);
  } else {
    console.error('❌ No document found to verify');
  }
  
  console.log('================================================');
  console.log('🏁 Thanks Roger document integration test complete');
}

// Run the test
main().catch(error => {
  console.error('Unhandled error in test:', error);
  process.exit(1);
});