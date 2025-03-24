#!/usr/bin/env node

import fetch from 'node-fetch';

async function testOpenAIIntegration() {
  try {
    console.log('🔍 Testing OpenAI integration with admin login...');
    
    // Login as admin user
    const appUrl = process.env.APP_URL || 'https://8dc3f57a-133b-45a5-ba2b-9e2b16042657-00-572nlsfm974b.janeway.replit.dev';
    const loginRes = await fetch(`${appUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@shifi.com',
        password: 'admin123'
      })
    });
    
    // Check login response
    if (!loginRes.ok) {
      throw new Error(`Login failed with status ${loginRes.status}: ${await loginRes.text()}`);
    }
    
    const loginData = await loginRes.json();
    console.log('✅ Login successful as admin user');
    
    // Get session cookies
    const cookies = loginRes.headers.get('set-cookie');
    if (!cookies) {
      throw new Error('No session cookies received from login');
    }
    
    // Test the underwriting recommendations endpoint
    console.log('🔍 Testing AI-powered underwriting recommendations...');
    const recommendationsRes = await fetch(`${appUrl}/api/admin/underwriting-recommendations`, {
      headers: { 'Cookie': cookies }
    });
    
    // Check recommendations response
    if (!recommendationsRes.ok) {
      throw new Error(`Failed to get recommendations: ${recommendationsRes.status}: ${await recommendationsRes.text()}`);
    }
    
    const data = await recommendationsRes.json();
    console.log('✅ Successfully received underwriting recommendations');
    
    // Verify OpenAI integration
    if (!data.dataSource) {
      console.log('❌ Missing dataSource field in response');
    } else if (!data.dataSource.includes('GPT-4.5')) {
      console.log('❌ Response does not mention GPT-4.5 in dataSource');
    } else {
      console.log('✅ Confirmed GPT-4.5 integration in dataSource');
    }
    
    // Check recommendations
    if (!data.recommendations || !Array.isArray(data.recommendations) || data.recommendations.length === 0) {
      console.log('❌ No recommendations found in response');
    } else {
      console.log(`✅ Found ${data.recommendations.length} recommendations`);
      
      // Display the recommendations
      console.log('\n📋 Underwriting recommendations:');
      data.recommendations.forEach((rec, i) => {
        console.log(`\n${i + 1}. ${rec.factor}`);
        console.log(`   Current: ${rec.currentThreshold}`);
        console.log(`   Recommended: ${rec.recommendedThreshold}`);
        console.log(`   Reasoning: ${rec.reasoning}`);
      });
    }
    
    console.log('\n📊 Summary:');
    console.log('- Data source:', data.dataSource);
    console.log('- Analysis date:', new Date(data.analysisDate).toLocaleString());
    console.log('- Samples analyzed:', data.complaintsSampleSize);
    
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Run the test
testOpenAIIntegration().then(success => {
  if (success) {
    console.log('\n🎉 OpenAI integration test completed successfully');
  } else {
    console.log('\n❌ OpenAI integration test failed');
    process.exit(1);
  }
});