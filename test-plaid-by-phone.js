/**
 * Test script for creating a Plaid asset report by phone number
 */
import fetch from 'node-fetch';

async function testCreateAssetReportByPhone() {
  try {
    // Replace with the actual access token and phone number
    const accessToken = 'access-sandbox-12345'; // This should be a real access token
    const phoneNumber = '9493223824'; // This should be the phone number for contract 67
    
    const response = await fetch('http://localhost:3000/api/plaid/create-asset-report-by-phone', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        accessToken,
        phoneNumber,
        daysRequested: 60,
        options: {
          client_report_id: 'test-report-' + Date.now()
        }
      }),
    });
    
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (!data.success) {
      console.error('ERROR: Failed to create asset report by phone');
    } else {
      console.log('SUCCESS: Asset report created successfully');
      console.log('Asset Report ID:', data.assetReportId);
      console.log('Contract ID:', data.contractId);
      console.log('User ID:', data.userId);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Execute the test
testCreateAssetReportByPhone();