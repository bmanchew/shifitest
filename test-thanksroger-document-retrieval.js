/**
 * Test script to verify document retrieval from Thanks Roger API after signatures
 * This script checks if signed documents are correctly retrieved from Thanks Roger
 */

// Use CommonJS imports since ESM might not be properly set up
const { db, pool } = require('./server/db');
const { contracts, applicationProgress } = require('./shared/schema');
const { eq, and, desc } = require('drizzle-orm');
const fetch = require('node-fetch');

// Utility function to check if a URL is accessible
async function isUrlAccessible(url) {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return {
      accessible: response.ok,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type')
    };
  } catch (error) {
    return {
      accessible: false,
      error: error.message
    };
  }
}

async function main() {
  console.log('Starting Thanks Roger document retrieval test...');
  console.log('----------------------------------------------');

  try {
    // Check if Thanks Roger API key is configured
    const thanksRogerApiKey = process.env.THANKS_ROGER_API_KEY || process.env.THANKSROGER_API_KEY;
    if (!thanksRogerApiKey) {
      console.error('Error: Thanks Roger API key not found in environment variables.');
      console.error('Please set either THANKS_ROGER_API_KEY or THANKSROGER_API_KEY');
      process.exit(1);
    }
    
    console.log('✓ Thanks Roger API key found in environment variables');

    // Find recently signed contracts (status = "signed" or "active")
    const recentContracts = await db.select()
      .from(contracts)
      .where(
        and(
          contracts.status.in(['signed', 'active']),
          contracts.signedAt.isNotNull()
        )
      )
      .orderBy(desc(contracts.signedAt))
      .limit(5);

    if (recentContracts.length === 0) {
      console.error('No recently signed contracts found in the database.');
      process.exit(1);
    }

    console.log(`Found ${recentContracts.length} recently signed contracts`);
    
    // Test document retrieval for each contract
    for (const contract of recentContracts) {
      console.log('\n----------------------------------------------');
      console.log(`Testing document retrieval for contract ID: ${contract.id}`);
      console.log(`Contract Number: ${contract.contractNumber}`);
      console.log(`Signed At: ${contract.signedAt}`);
      console.log(`Contract Status: ${contract.status}`);
      
      // Find document information in application progress table
      const progressRecords = await db.select()
        .from(applicationProgress)
        .where(
          and(
            applicationProgress.merchantId.eq(contract.id.toString()),
            applicationProgress.step.in(['contract_signed', 'document_signed'])
          )
        )
        .limit(1);
      
      if (progressRecords.length === 0) {
        console.log(`No signing progress record found for contract ID ${contract.id}`);
        continue;
      }
      
      const progressRecord = progressRecords[0];
      console.log('Found progress record:', {
        id: progressRecord.id,
        step: progressRecord.step,
        completed: progressRecord.completed,
        startedAt: progressRecord.startedAt,
        completedAt: progressRecord.completedAt
      });
      
      // Extract document URL from metadata if available
      let documentUrl = null;
      
      try {
        if (progressRecord.metadata) {
          const metadata = typeof progressRecord.metadata === 'string' 
            ? JSON.parse(progressRecord.metadata) 
            : progressRecord.metadata;
            
          documentUrl = metadata.documentUrl;
          
          console.log('Metadata found:', {
            documentUrl: documentUrl || 'Not found',
            hasSignatureId: !!metadata.signatureId,
            signedAt: metadata.signedAt || metadata.completedAt
          });
        }
      } catch (error) {
        console.error('Error parsing metadata:', error.message);
      }
      
      // If document URL not found in application progress, try the external fields
      if (!documentUrl && contract.externalDocumentId) {
        console.log(`Using external document ID: ${contract.externalDocumentId}`);
        
        // Try to fetch document details from Thanks Roger API
        try {
          const response = await fetch(`https://api.thanksroger.com/v1/documents/${contract.externalDocumentId}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${thanksRogerApiKey}`,
              'Accept': 'application/json'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            documentUrl = data.downloadUrl || data.viewUrl || data.documentUrl;
            console.log('Successfully retrieved document details from Thanks Roger API');
            console.log('Document URL:', documentUrl);
          } else {
            console.error(`Failed to retrieve document. Status: ${response.status} ${response.statusText}`);
            const errorText = await response.text();
            console.error('Error:', errorText);
          }
        } catch (error) {
          console.error('Error fetching document details from Thanks Roger:', error.message);
        }
      }
      
      // Try alternative approach - use the contract document endpoint
      if (!documentUrl) {
        console.log('Document URL not found in metadata or external ID, trying contract document endpoint...');
        
        try {
          // This approach simulates an actual API call to the application
          const response = await fetch(`http://localhost:5000/api/contracts/${contract.id}/document`, {
            method: 'GET',
            headers: {
              'Cookie': 'role=admin', // Simplified approach for testing 
              'X-Skip-Auth-For-Testing': 'true' // This might require backend support
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            documentUrl = data.documentUrl;
            console.log('Successfully retrieved document URL from contract document endpoint');
            console.log('Document URL:', documentUrl);
          } else {
            console.error(`Failed to retrieve document from endpoint. Status: ${response.status} ${response.statusText}`);
            const errorText = await response.text();
            console.error('Error:', errorText);
          }
        } catch (error) {
          console.error('Error calling contract document endpoint:', error.message);
        }
      }
      
      // Test if document URL is accessible
      if (documentUrl) {
        console.log('\nTesting document URL accessibility...');
        const urlStatus = await isUrlAccessible(documentUrl);
        
        if (urlStatus.accessible) {
          console.log('✓ Document URL is accessible');
          console.log('Content Type:', urlStatus.contentType);
          console.log('HTTP Status:', urlStatus.status, urlStatus.statusText);
        } else {
          console.error('✗ Document URL is not accessible');
          console.error('Error:', urlStatus.error || `HTTP ${urlStatus.status} ${urlStatus.statusText}`);
        }
      } else {
        console.error('✗ No document URL found for this contract');
      }
    }
    
    console.log('\n----------------------------------------------');
    console.log('Test completed');
    
  } catch (error) {
    console.error('An error occurred during testing:', error);
  } finally {
    // Close database connection
    await pool.end();
  }
}

// Run the main function
main();