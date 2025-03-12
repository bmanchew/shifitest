// Test CFPB API with correct parameters
import fetch from 'node-fetch';

async function testCFPBApi() {
  try {
    console.log('Testing CFPB API with correct parameters...\n');
    
    // Test personal loans
    console.log('1. Testing personal loan complaints API...');
    const personalLoanUrl = 'https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/?product=Payday%20loan%2C%20title%20loan%2C%20or%20personal%20loan&sub_product=Personal%20loan&date_received_min=2020-01-01&size=10&format=json';
    
    const personalLoanResponse = await fetch(personalLoanUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Financial-Platform/1.0'
      },
      timeout: 15000
    });
    
    const personalLoanData = await personalLoanResponse.json();
    console.log(`Personal loan complaints response status: ${personalLoanResponse.status}`);
    console.log(`Total personal loan complaints found: ${personalLoanData.hits?.total || 0}`);
    console.log(`Has aggregations: ${!!personalLoanData.aggregations}`);
    console.log(`Number of hits returned: ${personalLoanData.hits?.hits?.length || 0}`);
    
    if (personalLoanData.hits?.hits?.length > 0) {
      console.log('\nSample personal loan complaint:');
      const sample = personalLoanData.hits.hits[0]._source;
      console.log(`- Date received: ${sample.date_received}`);
      console.log(`- Product: ${sample.product}`);
      console.log(`- Issue: ${sample.issue}`);
      console.log(`- Company: ${sample.company}`);
    }
    
    // Test merchant cash advances
    console.log('\n2. Testing merchant cash advance complaints API...');
    const mcaUrl = 'https://www.consumerfinance.gov/data-research/consumer-complaints/search/api/v1/?product=Business%20loan&sub_product=Merchant%20cash%20advance&date_received_min=2020-01-01&size=10&format=json';
    
    const mcaResponse = await fetch(mcaUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Financial-Platform/1.0'
      },
      timeout: 15000
    });
    
    const mcaData = await mcaResponse.json();
    console.log(`MCA complaints response status: ${mcaResponse.status}`);
    console.log(`Total MCA complaints found: ${mcaData.hits?.total || 0}`);
    console.log(`Has aggregations: ${!!mcaData.aggregations}`);
    console.log(`Number of hits returned: ${mcaData.hits?.hits?.length || 0}`);
    
    if (mcaData.hits?.hits?.length > 0) {
      console.log('\nSample merchant cash advance complaint:');
      const sample = mcaData.hits.hits[0]._source;
      console.log(`- Date received: ${sample.date_received}`);
      console.log(`- Product: ${sample.product}`);
      console.log(`- Issue: ${sample.issue}`);
      console.log(`- Company: ${sample.company}`);
    }
    
  } catch (error) {
    console.error('Error testing CFPB API:', error);
  }
}

testCFPBApi();