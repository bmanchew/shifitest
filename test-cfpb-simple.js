// Simple test for CFPB API to check a single parameter
import fetch from 'node-fetch';

// Choose which test to run (1-4)
const TEST_NUMBER = 1;

async function testSimpleCFPBQuery() {
  try {
    console.log('Testing CFPB API with simple parameters...\n');
    
    let testUrl;
    let testDescription;
    
    // Select test based on TEST_NUMBER
    switch(TEST_NUMBER) {
      case 1:
        testDescription = 'Basic search with no filters';
        testUrl = 'https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/?format=json&size=1';
        break;
      case 2:
        testDescription = 'Search with term "loan"';
        testUrl = 'https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/?search_term=loan&format=json&size=1';
        break;
      case 3:
        testDescription = 'Search with date range only';
        testUrl = 'https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/?date_received_min=2022-01-01&date_received_max=2022-12-31&format=json&size=1';
        break;
      case 4:
        testDescription = 'Search for company "Bank of America"';
        testUrl = 'https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/?company=Bank%20of%20America&format=json&size=1';
        break;
      default:
        testDescription = 'Basic search with no filters';
        testUrl = 'https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/?format=json&size=1';
    }
    
    console.log(`Running test: ${testDescription}`);
    console.log(`URL: ${testUrl}\n`);
    
    const response = await fetch(testUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Financial-Platform/1.0'
      },
      timeout: 15000
    });
    
    console.log(`Response status: ${response.status}`);
    console.log(`Response status text: ${response.statusText}`);
    
    // Get response headers
    const headers = {};
    response.headers.forEach((value, name) => {
      headers[name] = value;
    });
    console.log('Response headers:', JSON.stringify(headers, null, 2));
    
    const responseText = await response.text();
    
    // Try to parse as JSON, or show raw text
    try {
      const data = JSON.parse(responseText);
      console.log('\nResponse data (first 500 chars):');
      console.log(JSON.stringify(data).substring(0, 500) + '...');
      
      // Show hit count if available
      if (data.hits && typeof data.hits.total !== 'undefined') {
        console.log(`\nTotal hits: ${data.hits.total}`);
        console.log(`Number of results returned: ${data.hits.hits?.length || 0}`);
      }
      
      // Check for throttling message
      if (responseText.includes('throttled')) {
        console.log('\nTHROTTLING DETECTED in response!');
      }
      
    } catch (parseError) {
      console.log('\nFailed to parse response as JSON. Raw response (first 500 chars):');
      console.log(responseText.substring(0, 500) + '...');
    }
    
  } catch (error) {
    console.error('Error testing CFPB API:', error);
  }
}

testSimpleCFPBQuery();