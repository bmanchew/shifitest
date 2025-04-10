/**
 * Direct Thanks Roger API verification script
 * 
 * This script tests the Thanks Roger API connection directly to:
 * 1. Verify API credentials are valid
 * 2. Check document template availability
 * 3. Verify document accessibility when a document ID is provided
 */

import fetch from 'node-fetch';

// Thanks Roger API credentials
const THANKSROGER_API_KEY = process.env.THANKS_ROGER_API_KEY || process.env.THANKSROGER_API_KEY;
const THANKSROGER_BASE_URL = 'https://api.thanksroger.com/v1';

/**
 * Check if API credentials are valid
 */
async function checkApiCredentials() {
  console.log('🔑 Verifying Thanks Roger API credentials...');
  
  if (!THANKSROGER_API_KEY) {
    console.error('❌ No Thanks Roger API key found in environment variables');
    console.error('Please set THANKS_ROGER_API_KEY or THANKSROGER_API_KEY');
    return false;
  }
  
  try {
    // Test API by retrieving templates
    const response = await fetch(`${THANKSROGER_BASE_URL}/templates`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${THANKSROGER_API_KEY}`,
        'Accept': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ API credentials valid, found ${data.length || 0} templates`);
      return true;
    } else {
      console.error(`❌ API credentials invalid, received status: ${response.status}`);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return false;
    }
  } catch (error) {
    console.error('❌ Error connecting to Thanks Roger API:', error.message);
    return false;
  }
}

/**
 * Check if a document is accessible
 * @param {string} documentId - Thanks Roger document ID to check
 */
async function checkDocumentAccessibility(documentId) {
  console.log(`🔍 Checking accessibility for document ID: ${documentId}`);
  
  if (!THANKSROGER_API_KEY) {
    console.error('❌ No Thanks Roger API key found in environment variables');
    return false;
  }
  
  try {
    // Try to retrieve document details
    const response = await fetch(`${THANKSROGER_BASE_URL}/documents/${documentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${THANKSROGER_API_KEY}`,
        'Accept': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Document details retrieved successfully:');
      console.log(`  - Document Name: ${data.name || 'Unnamed'}`);
      console.log(`  - Status: ${data.status || 'Unknown'}`);
      
      // Check if document URL is available
      const documentUrl = data.downloadUrl || data.viewUrl || data.documentUrl;
      if (documentUrl) {
        console.log(`  - Document URL: ${documentUrl}`);
        
        // Verify the document URL is accessible
        try {
          const urlResponse = await fetch(documentUrl, { method: 'HEAD' });
          console.log(`  - URL Accessible: ${urlResponse.ok}`);
          console.log(`  - Content Type: ${urlResponse.headers.get('content-type')}`);
        } catch (urlError) {
          console.error(`  - URL Accessibility Error: ${urlError.message}`);
        }
      } else {
        console.log('  - No document URL found in response');
      }
      
      return true;
    } else {
      console.error(`❌ Failed to retrieve document, received status: ${response.status}`);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return false;
    }
  } catch (error) {
    console.error('❌ Error checking document:', error.message);
    return false;
  }
}

/**
 * List available templates from Thanks Roger
 */
async function listTemplates() {
  console.log('📋 Retrieving Thanks Roger templates...');
  
  if (!THANKSROGER_API_KEY) {
    console.error('❌ No Thanks Roger API key found in environment variables');
    return false;
  }
  
  try {
    const response = await fetch(`${THANKSROGER_BASE_URL}/templates`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${THANKSROGER_API_KEY}`,
        'Accept': 'application/json'
      }
    });
    
    if (response.ok) {
      const templates = await response.json();
      console.log(`✅ Retrieved ${templates.length || 0} templates`);
      
      if (templates.length > 0) {
        console.log('Templates:');
        templates.forEach((template, index) => {
          console.log(`  ${index + 1}. ${template.name || 'Unnamed'} (ID: ${template.id})`);
        });
      }
      
      return templates;
    } else {
      console.error(`❌ Failed to retrieve templates, received status: ${response.status}`);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return [];
    }
  } catch (error) {
    console.error('❌ Error retrieving templates:', error.message);
    return [];
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting Thanks Roger API direct check');
  console.log('======================================');
  
  // Check API credentials
  const credentialsValid = await checkApiCredentials();
  if (!credentialsValid) {
    console.error('❌ API credential check failed, aborting further tests');
    process.exit(1);
  }
  
  // List templates
  const templates = await listTemplates();
  
  // Check document if document ID is provided
  const documentId = process.argv[2];
  if (documentId) {
    console.log(`🔖 Document ID provided: ${documentId}`);
    await checkDocumentAccessibility(documentId);
  } else {
    console.log('⚠️ No document ID provided. To check a document, run with:');
    console.log('node check-thanksroger-api.js <document-id>');
  }
  
  console.log('======================================');
  console.log('🏁 Thanks Roger API check complete');
}

// Run the script
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});