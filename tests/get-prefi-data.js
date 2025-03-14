
const axios = require('axios');
const hostname = window?.location?.hostname || (typeof location !== 'undefined' ? location.hostname : 'localhost');
const baseUrl = `https://${hostname}/api`;

async function getPreFiData() {
  try {
    // Get user data
    const userResponse = await axios.get(`${baseUrl}/customers/6`);
    const userData = userResponse.data;
    console.log('User Data:', userData);

    // Get contract data 
    const contractResponse = await axios.get(`${baseUrl}/contracts?userId=6`);
    const contractData = contractResponse.data;
    console.log('Contract Data:', contractData);

    // Get underwriting data if exists
    const underwritingResponse = await axios.get(`${baseUrl}/underwriting/user/6`);
    console.log('Underwriting Data:', underwritingResponse.data);

    // Make PreFi API call
    const prefiResponse = await axios.post(`${baseUrl}/underwriting/prefi-check`, {
      userId: 6,
      ssn: userData.ssn,
      firstName: userData.firstName, 
      lastName: userData.lastName,
      dob: userData.dob,
      address: userData.address
    });
    
    console.log('PreFi API Response:', prefiResponse.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

getPreFiData();
