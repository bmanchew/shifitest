const fetch = require('node-fetch');

async function testPortfolioMonitoring() {
  console.log('Testing portfolio monitoring endpoints...');

  // Get the latest portfolio monitoring data
  try {
    const response = await fetch('http://localhost:3000/api/admin/reports/portfolio-health');
    const data = await response.json();
    
    console.log('Portfolio health response:', JSON.stringify(data, null, 2));
    
    if (data.success === false) {
      console.error('Error fetching portfolio health:', data.message || 'Unknown error');
      return false;
    }
    
    console.log('✅ Successfully retrieved portfolio health data');
    return true;
  } catch (error) {
    console.error('Error in portfolio monitoring test:', error.message);
    return false;
  }
}

// Run the test
testPortfolioMonitoring().then(success => {
  console.log('Test completed with status:', success ? 'SUCCESS' : 'FAILED');
  // Exit with appropriate code
  process.exit(success ? 0 : 1);
});