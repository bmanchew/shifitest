/**
 * CFPB API Response Format Test Script
 * 
 * This script tests the CFPB API to verify our ability to handle different
 * Elasticsearch response formats and properly extract data.
 */

const fetch = require('node-fetch');

// Base URL for CFPB API
const baseUrl = 'https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/';

// Target product categories
const targetProducts = [
  'Payday loan, title loan, or personal loan',
  'Business loan'
];

/**
 * Simple sleep function for rate limiting
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Get total count from response, handling different formats
 */
function getComplaintsCount(data) {
  if (!data) return 0;
  
  if (data.hits?.total) {
    if (typeof data.hits.total === 'number') {
      return data.hits.total;
    } else if (typeof data.hits.total === 'object' && data.hits.total.value) {
      return data.hits.total.value;
    }
  } else if (Array.isArray(data) && data.length > 0) {
    return data.length;
  } else if (data.trends && Array.isArray(data.trends)) {
    return data.trends.length;
  }
  
  return 0;
}

/**
 * Fetch complaints from CFPB API
 */
async function fetchComplaints(product, options = {}) {
  const params = new URLSearchParams();
  
  // Add product filter
  params.append('product', product);
  
  // Add date range - using 2 year lookback by default
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  params.append('date_received_min', options.dateReceivedMin || twoYearsAgo.toISOString().split('T')[0]);
  
  // Add size parameter
  params.append('size', options.size || '100');
  
  // Request aggregations for trend analysis
  params.append('no_aggs', 'false');
  
  // Request fields we need
  params.append('field', 'company');
  params.append('field', 'issue');
  params.append('field', 'product');
  params.append('field', 'date_received');
  params.append('field', 'sub_product');
  
  // Format should be JSON
  params.append('format', 'json');
  
  console.log(`Fetching CFPB complaints for product: ${product}`);
  console.log(`API URL: ${baseUrl}?${params.toString()}`);
  
  try {
    const response = await fetch(`${baseUrl}?${params.toString()}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Financial-Platform-Test/1.0'
      }
    });
    
    if (!response.ok) {
      console.error(`API error: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const responseText = await response.text();
    
    // Check if response is HTML instead of JSON
    if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
      console.error('Received HTML instead of JSON');
      return null;
    }
    
    const data = JSON.parse(responseText);
    
    // Log response analysis
    console.log(`Response for ${product}:`);
    console.log(`- Format: ${Array.isArray(data) ? 'Array' : 'Object'}`);
    console.log(`- Has hits property: ${!!data.hits}`);
    
    if (data.hits?.total) {
      console.log(`- Total format: ${typeof data.hits.total}`);
      if (typeof data.hits.total === 'object') {
        console.log(`- Total value: ${data.hits.total.value}`);
        console.log(`- Total relation: ${data.hits.total.relation}`);
      } else {
        console.log(`- Total value: ${data.hits.total}`);
      }
    }
    
    console.log(`- Has aggregations: ${!!data.aggregations}`);
    if (data.aggregations) {
      console.log(`- Aggregation keys: ${Object.keys(data.aggregations).join(', ')}`);
    }
    
    // Calculate count using our helper
    const complaintsCount = getComplaintsCount(data);
    console.log(`- Processed complaint count: ${complaintsCount}`);
    
    // Log a sample result
    if (data.hits?.hits?.length > 0) {
      console.log('- Sample hit:');
      console.log(JSON.stringify(data.hits.hits[0]._source, null, 2).substring(0, 500) + '...');
    }
    
    return data;
  } catch (error) {
    console.error(`Error fetching complaints: ${error.message}`);
    return null;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('==== CFPB API Response Format Test ====');
  console.log('Testing various product categories to verify response format handling\n');
  
  for (const product of targetProducts) {
    console.log(`\n===== Testing "${product}" =====`);
    await fetchComplaints(product);
    
    // Wait between requests to avoid rate limiting
    await sleep(2000);
  }
  
  console.log('\n===== Testing Trends API =====');
  try {
    const params = new URLSearchParams();
    params.append('product', 'Payday loan, title loan, or personal loan');
    params.append('format', 'json');
    
    const trendsUrl = baseUrl.replace(/\/$/, '') + '/trends';
    console.log(`API URL: ${trendsUrl}?${params.toString()}`);
    
    const response = await fetch(`${trendsUrl}?${params.toString()}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Financial-Platform-Test/1.0'
      }
    });
    
    if (!response.ok) {
      console.error(`API error: ${response.status} ${response.statusText}`);
      return;
    }
    
    const data = JSON.parse(await response.text());
    console.log(`Trends response format: ${typeof data}`);
    console.log(`Response keys: ${Object.keys(data).join(', ')}`);
    
    if (data.trends) {
      console.log(`Trends data found: ${data.trends.length} items`);
    }
    
    // Wait between requests to avoid rate limiting
    await sleep(2000);
  } catch (error) {
    console.error(`Error testing trends API: ${error.message}`);
  }
  
  console.log('\nTest completed');
}

// Run all tests
runTests().catch(console.error);