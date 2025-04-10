/**
 * Thanks Roger Document Flow Monitor
 * 
 * This script helps monitor the Thanks Roger document flow by:
 * 1. Periodically checking for new signed documents
 * 2. Verifying document URLs are accessible
 * 3. Providing real-time feedback on document signing and retrieval
 * 4. Detecting any issues in the document flow
 */

const fetch = require('node-fetch');
const { db } = require('./server/db');
const { contracts, applicationProgress } = require('./shared/schema');
const { eq, and, isNotNull, gte } = require('drizzle-orm');

// Configuration
const THANKSROGER_API_KEY = process.env.THANKS_ROGER_API_KEY || process.env.THANKSROGER_API_KEY;
const CHECK_INTERVAL_MS = 10000; // Check every 10 seconds
const MAX_DOCUMENT_AGE_DAYS = 7; // Only check documents from the last 7 days

// Keep track of documents we've already checked
const checkedDocuments = new Set();

/**
 * Format date for display
 */
function formatDate(date) {
  return new Date(date).toLocaleString();
}

/**
 * Check if a document URL is accessible
 */
async function checkDocumentUrl(url) {
  if (!url) return { accessible: false, contentType: null, error: 'No URL provided' };
  
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return {
      accessible: response.ok,
      contentType: response.headers.get('content-type'),
      status: response.status,
      statusText: response.statusText
    };
  } catch (error) {
    return {
      accessible: false,
      contentType: null,
      error: error.message
    };
  }
}

/**
 * Check Thanks Roger API for a document by ID
 */
async function checkDocumentInThanksRoger(documentId) {
  if (!THANKSROGER_API_KEY || !documentId) return null;
  
  try {
    const response = await fetch(`https://api.thanksroger.com/v1/documents/${documentId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${THANKSROGER_API_KEY}`,
        'Accept': 'application/json'
      }
    });
    
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error(`Error retrieving document ${documentId} from Thanks Roger:`, error.message);
    return null;
  }
}

/**
 * Find recent documents with Thanks Roger URLs
 */
async function findRecentDocuments() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - MAX_DOCUMENT_AGE_DAYS);
  
  try {
    // Find recently signed contracts
    const recentContracts = await db.select({
      id: contracts.id,
      contractNumber: contracts.contractNumber,
      status: contracts.status,
      signedAt: contracts.signedAt,
      merchantId: contracts.merchantId,
      customerId: contracts.customerId,
      externalDocumentId: contracts.externalDocumentId,
      externalSignatureId: contracts.externalSignatureId
    })
    .from(contracts)
    .where(
      and(
        contracts.status.in(['signed', 'active']),
        contracts.signedAt.isNotNull(),
        contracts.signedAt.gte(cutoffDate)
      )
    )
    .orderBy(contracts.signedAt);
    
    const documentsWithUrls = [];
    
    // For each contract, try to find the document URL
    for (const contract of recentContracts) {
      // Skip contracts we've already checked
      if (checkedDocuments.has(contract.id)) continue;
      
      // Try to find document URL in application progress
      const progressRecords = await db.select()
        .from(applicationProgress)
        .where(
          and(
            applicationProgress.contractId.eq(contract.id),
            applicationProgress.step.in(['signing', 'contract_signed', 'document_signed'])
          )
        );
      
      let documentUrl = null;
      let metadata = null;
      
      // Extract document URL from metadata if available
      if (progressRecords.length > 0) {
        for (const record of progressRecords) {
          try {
            if (record.data) {
              const recordData = typeof record.data === 'string' 
                ? JSON.parse(record.data) 
                : record.data;
                
              if (recordData.documentUrl) {
                documentUrl = recordData.documentUrl;
                metadata = recordData;
                break;
              }
            }
          } catch (error) {
            console.error(`Error parsing metadata for progress record ${record.id}:`, error.message);
          }
        }
      }
      
      // Add to the list if document URL found
      if (documentUrl) {
        documentsWithUrls.push({
          id: contract.id,
          contractId: contract.id,
          contractNumber: contract.contractNumber,
          status: contract.status,
          signedAt: contract.signedAt,
          documentUrl,
          externalDocumentId: contract.externalDocumentId,
          externalSignatureId: contract.externalSignatureId,
          metadata
        });
      }
    }
    
    return documentsWithUrls;
  } catch (error) {
    console.error('Error finding recent documents:', error.message);
    return [];
  }
}

/**
 * Check a document and update its status
 */
async function checkDocument(document) {
  console.log(`\n📄 Checking document for contract #${document.contractNumber} (ID: ${document.contractId})`);
  console.log(`   Signed: ${formatDate(document.signedAt)}`);
  
  // Mark as checked so we don't check it again
  checkedDocuments.add(document.contractId);
  
  // Check if document URL is accessible
  const urlCheck = await checkDocumentUrl(document.documentUrl);
  
  console.log(`   Document URL: ${document.documentUrl}`);
  console.log(`   Accessible: ${urlCheck.accessible ? '✅ Yes' : '❌ No'}`);
  
  if (urlCheck.accessible) {
    console.log(`   Content Type: ${urlCheck.contentType}`);
  } else if (urlCheck.error) {
    console.log(`   Error: ${urlCheck.error}`);
  }
  
  // Check document in Thanks Roger API if we have the API key and external document ID
  if (THANKSROGER_API_KEY && document.externalDocumentId) {
    console.log(`   Thanks Roger Document ID: ${document.externalDocumentId}`);
    
    const thanksRogerDocument = await checkDocumentInThanksRoger(document.externalDocumentId);
    
    if (thanksRogerDocument) {
      console.log(`   Thanks Roger Status: ✅ Document found`);
      console.log(`   Document Name: ${thanksRogerDocument.name || 'Unnamed'}`);
      console.log(`   Document Status: ${thanksRogerDocument.status || 'Unknown'}`);
      
      const apiDocumentUrl = thanksRogerDocument.downloadUrl || 
                            thanksRogerDocument.viewUrl || 
                            thanksRogerDocument.documentUrl;
                            
      if (apiDocumentUrl) {
        console.log(`   Thanks Roger URL: ${apiDocumentUrl}`);
        
        // Compare with stored URL
        if (apiDocumentUrl !== document.documentUrl) {
          console.log(`   ⚠️ Warning: Stored document URL doesn't match Thanks Roger API URL`);
        }
        
        // Check Thanks Roger URL if different from stored URL
        if (apiDocumentUrl !== document.documentUrl) {
          const apiUrlCheck = await checkDocumentUrl(apiDocumentUrl);
          console.log(`   Thanks Roger URL Accessible: ${apiUrlCheck.accessible ? '✅ Yes' : '❌ No'}`);
          
          if (apiUrlCheck.accessible) {
            console.log(`   Content Type: ${apiUrlCheck.contentType}`);
          } else if (apiUrlCheck.error) {
            console.log(`   Error: ${apiUrlCheck.error}`);
          }
        }
      }
    } else {
      console.log(`   Thanks Roger Status: ❌ Document not found or API error`);
    }
  }
}

/**
 * Main monitoring function
 */
async function monitorDocuments() {
  console.log('🔍 Checking for recent Thanks Roger documents...');
  
  const documents = await findRecentDocuments();
  console.log(`Found ${documents.length} recent documents with Thanks Roger URLs`);
  
  // Check each document
  for (const document of documents) {
    await checkDocument(document);
  }
  
  // Schedule next check
  setTimeout(monitorDocuments, CHECK_INTERVAL_MS);
}

/**
 * Check if Thanks Roger API key is available
 */
function checkApiKeyAvailability() {
  if (!THANKSROGER_API_KEY) {
    console.warn('\n⚠️ No Thanks Roger API key found in environment variables');
    console.warn('⚠️ Set THANKS_ROGER_API_KEY or THANKSROGER_API_KEY for API verification');
    console.warn('⚠️ Will still check document URLs but cannot verify with the Thanks Roger API\n');
    return false;
  }
  console.log('\n✅ Thanks Roger API key found in environment\n');
  return true;
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting Thanks Roger document flow monitor');
  console.log('============================================');
  console.log(`Checking documents from the last ${MAX_DOCUMENT_AGE_DAYS} days`);
  console.log(`Monitor interval: ${CHECK_INTERVAL_MS / 1000} seconds`);
  
  // Check API key availability
  checkApiKeyAvailability();
  
  // Start monitoring
  await monitorDocuments();
}

// Run the monitor
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});