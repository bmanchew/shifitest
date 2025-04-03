/**
 * Simple script to test login functionality directly
 */
import axios from 'axios';

const API_URL = 'http://localhost:5000';

async function testLogin() {
  try {
    console.log('Getting CSRF token...');
    const csrfResponse = await axios.get(`${API_URL}/api/csrf-token`);
    console.log('CSRF response:', csrfResponse.data);
    const csrfToken = csrfResponse.data.csrfToken;
    console.log('Got CSRF token:', csrfToken);

    console.log('Attempting to login...');
    const loginResponse = await axios.post(
      `${API_URL}/api/auth/login`,
      {
        email: 'test@shilohfinance.com',
        password: 'testPassword123'
      },
      {
        headers: {
          'X-CSRF-Token': csrfToken
        }
      }
    );

    console.log('Login response:', loginResponse.data);
    console.log('Login cookies:', loginResponse.headers['set-cookie']);
    
    return loginResponse.data;
  } catch (error) {
    console.error('Error in login:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
(async () => {
  await testLogin();
})();