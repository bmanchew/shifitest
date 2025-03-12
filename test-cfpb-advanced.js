// Advanced testing script for CFPB API with optimized parameters and throttling handling
import fetch from 'node-fetch';

// Delay utility for handling throttling
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch with retry and throttling handling
 */
async function fetchWithRetry(url, options, maxRetries = 3) {
  let retries = 0;
  let lastError = null;
  
  while (retries <= maxRetries) {
    try {
      console.log(`Attempt ${retries + 1} for URL: ${url}`);
      const response = await fetch(url, options);
      const text = await response.text();
      
      // Check for throttling
      if (response.status === 429 || text.includes("throttled")) {
        let waitTime = 2000 * Math.pow(2, retries);
        
        // Extract wait time if available
        const waitTimeMatch = text.match(/Expected available in (\d+) seconds/);
        if (waitTimeMatch && waitTimeMatch[1]) {
          const seconds = parseInt(waitTimeMatch[1], 10);
          waitTime = (seconds + 1) * 1000; // Convert to ms and add buffer
        }
        
        console.log(`Request throttled. Retrying in ${waitTime/1000} seconds...`);
        await delay(waitTime);
        retries++;
        continue;
      }
      
      try {
        // Try to parse as JSON
        const data = JSON.parse(text);
        return { response, data };
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', parseError.message);
        console.log('Response preview:', text.substring(0, 500));
        throw new Error('Invalid JSON response');
      }
    } catch (error) {
      lastError = error;
      
      // Only retry on network errors or timeouts
      if (error.message.includes('timeout') || 
          error.message.includes('network') ||
          error.message.includes('ECONNRESET')) {
        const waitTime = 1000 * Math.pow(2, retries);
        console.log(`Network error. Retrying in ${waitTime/1000} seconds...`);
        await delay(waitTime);
        retries++;
        continue;
      }
      
      throw error;
    }
  }
  
  throw lastError || new Error('Failed after max retries');
}

/**
 * Test different parameter variations for the CFPB API
 */
async function testCFPBApiWithParams() {
  const fetchOptions = {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Financial-Platform/1.0'
    },
    timeout: 30000 // Longer timeout
  };
  
  try {
    console.log('============================================');
    console.log('TESTING CFPB API WITH DIFFERENT PARAMETERS');
    console.log('============================================\n');
    
    // Test 1: Minimal query with no product filter
    console.log('\n1. Testing minimal query with no product filter:');
    const minimalUrl = 'https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/?format=json&size=5';
    try {
      const { data } = await fetchWithRetry(minimalUrl, fetchOptions);
      console.log(`- Status: Success`);
      console.log(`- Total complaints: ${data.hits?.total || 0}`);
      console.log(`- Results returned: ${data.hits?.hits?.length || 0}`);
    } catch (error) {
      console.error(`- Error: ${error.message}`);
    }
    
    // Pause between requests to avoid throttling
    await delay(5000);
    
    // Test 2: Using date range only
    console.log('\n2. Testing with date range only:');
    const dateRangeUrl = 'https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/?date_received_min=2023-01-01&date_received_max=2023-12-31&format=json&size=5';
    try {
      const { data } = await fetchWithRetry(dateRangeUrl, fetchOptions);
      console.log(`- Status: Success`);
      console.log(`- Total complaints for 2023: ${data.hits?.total || 0}`);
      console.log(`- Results returned: ${data.hits?.hits?.length || 0}`);
    } catch (error) {
      console.error(`- Error: ${error.message}`);
    }
    
    // Pause between requests
    await delay(5000);
    
    // Test 3: Using search term
    console.log('\n3. Testing with search term "loan":');
    const searchTermUrl = 'https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/?search_term=loan&format=json&size=5';
    try {
      const { data } = await fetchWithRetry(searchTermUrl, fetchOptions);
      console.log(`- Status: Success`);
      console.log(`- Total complaints with term "loan": ${data.hits?.total || 0}`);
      console.log(`- Results returned: ${data.hits?.hits?.length || 0}`);
    } catch (error) {
      console.error(`- Error: ${error.message}`);
    }
    
    // Pause between requests
    await delay(5000);
    
    // Test 4: Using specific field name
    console.log('\n4. Testing with specific field filters:');
    const fieldUrl = 'https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/?field=date_received&field=product&field=company&format=json&size=5';
    try {
      const { data } = await fetchWithRetry(fieldUrl, fetchOptions);
      console.log(`- Status: Success`);
      console.log(`- Total complaints: ${data.hits?.total || 0}`);
      console.log(`- Results returned: ${data.hits?.hits?.length || 0}`);
    } catch (error) {
      console.error(`- Error: ${error.message}`);
    }
    
    // Pause between requests
    await delay(5000);
    
    // Test 5: Testing personal loan with exact string
    console.log('\n5. Testing with exact product string "Payday loan, title loan, or personal loan":');
    const exactProductUrl = 'https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/?product=Payday%20loan%2C%20title%20loan%2C%20or%20personal%20loan&format=json&size=5';
    try {
      const { data } = await fetchWithRetry(exactProductUrl, fetchOptions);
      console.log(`- Status: Success`);
      console.log(`- Total payday/personal loan complaints: ${data.hits?.total || 0}`);
      console.log(`- Results returned: ${data.hits?.hits?.length || 0}`);
    } catch (error) {
      console.error(`- Error: ${error.message}`);
    }
    
    // Pause between requests
    await delay(5000);
    
    // Test 6: Using company filter
    console.log('\n6. Testing with company filter:');
    const companyUrl = 'https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/?company=Bank%20of%20America&format=json&size=5';
    try {
      const { data } = await fetchWithRetry(companyUrl, fetchOptions);
      console.log(`- Status: Success`);
      console.log(`- Total Bank of America complaints: ${data.hits?.total || 0}`);
      console.log(`- Results returned: ${data.hits?.hits?.length || 0}`);
    } catch (error) {
      console.error(`- Error: ${error.message}`);
    }
    
    // Pause between requests
    await delay(5000);
    
    // Test 7: Testing with trends endpoint
    console.log('\n7. Testing trends endpoint:');
    const trendsUrl = 'https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/trends/?date_received_min=2022-01-01&date_received_max=2022-12-31&format=json';
    try {
      const { data } = await fetchWithRetry(trendsUrl, fetchOptions);
      console.log(`- Status: Success`);
      console.log(`- Has trends data: ${!!data.trends}`);
      console.log(`- Data keys: ${Object.keys(data).join(', ')}`);
    } catch (error) {
      console.error(`- Error: ${error.message}`);
    }
    
  } catch (mainError) {
    console.error('Main test error:', mainError);
  }
}

// Run the tests
testCFPBApiWithParams();