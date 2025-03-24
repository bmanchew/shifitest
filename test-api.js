import fetch from 'node-fetch';

async function testApiWithAuth() {
  try {
    console.log('Logging in...');
    
    // First, login to get a session cookie
    const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'admin@shifi.com',
        password: 'admin123'
      })
    });
    
    if (!loginResponse.ok) {
      const error = await loginResponse.json();
      console.error('Login failed:', error);
      return;
    }
    
    const loginData = await loginResponse.json();
    console.log('Login successful:', loginData.success);
    
    // Get the cookies from the login response
    const cookies = loginResponse.headers.get('set-cookie');
    
    // Now make the authenticated request to get the underwriting recommendations
    console.log('Fetching underwriting recommendations...');
    const recommendationsResponse = await fetch('http://localhost:5000/api/admin/reports/underwriting-recommendations', {
      method: 'GET',
      headers: {
        'Cookie': cookies
      }
    });
    
    if (!recommendationsResponse.ok) {
      const error = await recommendationsResponse.json();
      console.error('Fetching recommendations failed:', error);
      return;
    }
    
    const recommendationsData = await recommendationsResponse.json();
    console.log('Received recommendations:');
    console.log(JSON.stringify(recommendationsData, null, 2));
    
    // Check if the response contains data from OpenAI
    if (recommendationsData.dataSource && recommendationsData.dataSource.includes('GPT-4.5')) {
      console.log('✅ Confirmed OpenAI GPT-4.5 integration is working!');
    } else {
      console.log('❌ GPT-4.5 integration is not mentioned in the response');
    }
    
    // Check the recommendations generated
    if (recommendationsData.recommendations && recommendationsData.recommendations.length > 0) {
      console.log(`Found ${recommendationsData.recommendations.length} recommendations:`);
      recommendationsData.recommendations.forEach((rec, index) => {
        console.log(`Recommendation ${index + 1}: ${rec.factor}`);
      });
    }
    
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

testApiWithAuth();