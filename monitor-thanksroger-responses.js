/**
 * This script monitors API responses from Thanks Roger 
 * It continuously checks the application logs for Thanks Roger API activity
 * and extracts document URLs and other relevant information
 */

const { createReadStream } = require('fs');
const { createInterface } = require('readline');
const path = require('path');

// Configuration
const LOG_DIRECTORY = './logs';
const LOG_FILE = path.join(LOG_DIRECTORY, 'api.log');
const POLL_INTERVAL = 2000; // 2 seconds

// Track which lines we've already processed
let lastProcessedLine = 0;
let thanksRogerResponses = [];

// Process log entries
function processLogEntry(line) {
  try {
    // Check if it's a JSON log line
    const logEntry = JSON.parse(line);
    
    // Only process Thanks Roger API related logs
    if (
      (logEntry.source === 'thanksroger' || logEntry.category === 'contract') &&
      logEntry.metadata && 
      (logEntry.metadata.documentUrl || logEntry.message?.includes('signing successful'))
    ) {
      // Extract relevant information
      const documentInfo = {
        timestamp: logEntry.timestamp || new Date().toISOString(),
        message: logEntry.message,
        contractId: logEntry.metadata.contractId,
        documentUrl: logEntry.metadata.documentUrl,
        signatureId: logEntry.metadata.signatureId,
        success: logEntry.level !== 'error'
      };
      
      thanksRogerResponses.push(documentInfo);
      
      console.log('\n==================================================');
      console.log('Thanks Roger API Activity Detected!');
      console.log('--------------------------------------------------');
      console.log('Timestamp:', documentInfo.timestamp);
      console.log('Message:', documentInfo.message);
      console.log('Contract ID:', documentInfo.contractId || 'N/A');
      console.log('Signature ID:', documentInfo.signatureId || 'N/A');
      
      if (documentInfo.documentUrl) {
        console.log('Document URL:', documentInfo.documentUrl);
        console.log('--------------------------------------------------');
        console.log('✓ Document URL detected - API is returning documents');
      } else {
        console.log('--------------------------------------------------');
        console.log('✗ No document URL found in this log entry');
      }
      
      return true;
    }
    
    // Check also for document retrieval endpoints
    if (
      logEntry.category === 'api' &&
      logEntry.metadata?.path?.includes('/document') &&
      logEntry.metadata?.method === 'GET'
    ) {
      console.log('\n==================================================');
      console.log('Document Retrieval Request Detected:');
      console.log('--------------------------------------------------');
      console.log('Timestamp:', logEntry.timestamp);
      console.log('Path:', logEntry.metadata.path);
      console.log('Status:', logEntry.metadata.statusCode || 'N/A');
      console.log('--------------------------------------------------');
      
      return true;
    }
    
    return false;
  } catch (error) {
    // Not a JSON line or other error, ignore
    return false;
  }
}

// Poll log file for changes
async function pollLogFile() {
  try {
    const rl = createInterface({
      input: createReadStream(LOG_FILE, { start: lastProcessedLine }),
      crlfDelay: Infinity
    });

    let newPosition = lastProcessedLine;
    let foundEntries = 0;

    for await (const line of rl) {
      newPosition += line.length + 1; // +1 for the newline character
      if (processLogEntry(line)) {
        foundEntries++;
      }
    }

    lastProcessedLine = newPosition;
    
    if (foundEntries === 0) {
      process.stdout.write('.');
    }
    
    // Schedule the next poll
    setTimeout(pollLogFile, POLL_INTERVAL);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(`Log file ${LOG_FILE} not found. Checking again in ${POLL_INTERVAL/1000} seconds.`);
    } else {
      console.error('Error polling log file:', error.message);
    }
    
    // Schedule the next poll even if there was an error
    setTimeout(pollLogFile, POLL_INTERVAL);
  }
}

// Function to check for new API activity
function summarizeFindings() {
  console.log('\n==================================================');
  console.log('SUMMARY OF THANKS ROGER API ACTIVITY');
  console.log('--------------------------------------------------');
  
  if (thanksRogerResponses.length === 0) {
    console.log('No Thanks Roger API activity detected yet.');
    console.log('Please try signing a contract to generate activity.');
  } else {
    console.log(`Found ${thanksRogerResponses.length} Thanks Roger API interactions:`);
    
    // Count how many have document URLs
    const withDocumentUrls = thanksRogerResponses.filter(r => r.documentUrl).length;
    
    console.log(`- ${withDocumentUrls} responses included document URLs`);
    console.log(`- ${thanksRogerResponses.length - withDocumentUrls} responses without document URLs`);
    
    if (withDocumentUrls > 0) {
      console.log('\nThe system IS retrieving document URLs from Thanks Roger.');
      console.log('This indicates the document retrieval process is working correctly.');
    } else {
      console.log('\nNo document URLs have been retrieved from Thanks Roger yet.');
      console.log('This might indicate an issue with document retrieval, or no documents have been requested.');
    }
  }
}

// Main function
async function main() {
  console.log('Starting Thanks Roger API response monitor...');
  console.log(`Monitoring log file: ${LOG_FILE}`);
  console.log('Press Ctrl+C to quit, or enter "summary" to see current findings');
  console.log('Waiting for Thanks Roger API activity...');
  
  // Start polling the log file
  pollLogFile();
  
  // Setup process exit handler
  process.on('SIGINT', () => {
    console.log('\n\nMonitoring stopped. Final summary:');
    summarizeFindings();
    process.exit(0);
  });
  
  // Setup stdin for manual commands
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (data) => {
    const command = data.trim().toLowerCase();
    
    if (command === 'summary') {
      summarizeFindings();
    } else if (command === 'quit' || command === 'exit') {
      console.log('\nExiting...');
      process.exit(0);
    }
  });
}

// Run the main function
main().catch(error => {
  console.error('Error:', error);
});