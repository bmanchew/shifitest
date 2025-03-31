/**
 * Investor Portal Test Suite
 * 
 * This file contains comprehensive tests for the investor portal functionality,
 * ensuring that all components, API endpoints, and security measures work as expected.
 */

const axios = require('axios');
const { expect } = require('chai');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// Base URL for API tests
const API_BASE_URL = 'http://localhost:5000/api';

// Test user credentials
const TEST_INVESTOR = {
  email: `test-investor-${Date.now()}@example.com`,
  password: 'securePassword123!',
  firstName: 'Test',
  lastName: 'Investor',
  phone: '555-123-4567'
};

// Stored auth token and cookies
let authToken = null;
let cookies = null;
let csrfToken = null;
let testInvestorId = null;
let testOfferingId = null;
let testDocumentId = null;
let testInvestmentId = null;

// Helper to make authenticated API requests
async function makeAuthRequest(method, endpoint, data = null) {
  try {
    const headers = {
      'Cookie': cookies,
      'X-CSRF-Token': csrfToken
    };
    
    const config = { headers, withCredentials: true };
    
    let response;
    if (method === 'GET') {
      response = await axios.get(`${API_BASE_URL}${endpoint}`, config);
    } else if (method === 'POST') {
      response = await axios.post(`${API_BASE_URL}${endpoint}`, data, config);
    } else if (method === 'PUT') {
      response = await axios.put(`${API_BASE_URL}${endpoint}`, data, config);
    } else if (method === 'DELETE') {
      response = await axios.delete(`${API_BASE_URL}${endpoint}`, config);
    }
    
    if (response.headers['set-cookie']) {
      cookies = response.headers['set-cookie'];
    }
    
    return response.data;
  } catch (error) {
    console.error(`API request failed (${method} ${endpoint}):`, error.response?.data || error.message);
    throw error;
  }
}

// Helper to get a CSRF token
async function getCsrfToken() {
  try {
    const response = await axios.get(`${API_BASE_URL}/csrf-token`);
    if (response.headers['set-cookie']) {
      cookies = response.headers['set-cookie'];
    }
    return response.data.csrfToken;
  } catch (error) {
    console.error('Failed to get CSRF token:', error.response?.data || error.message);
    throw error;
  }
}

describe('Investor Portal Tests', function() {
  this.timeout(10000); // Increase timeout for tests

  // Run before all tests
  before(async function() {
    try {
      // Get initial CSRF token
      csrfToken = await getCsrfToken();
      console.log('Initial setup completed - CSRF token obtained');
    } catch (error) {
      console.error('Before hook failed:', error);
      throw error;
    }
  });

  // Test authentication
  describe('Authentication', function() {
    it('should register a new investor', async function() {
      const applicationData = {
        name: `${TEST_INVESTOR.firstName} ${TEST_INVESTOR.lastName}`,
        email: TEST_INVESTOR.email,
        phone: TEST_INVESTOR.phone,
        investmentAmount: '25000',
        investmentGoals: 'Testing the investor portal',
        isAccredited: true,
        agreeToTerms: true
      };
      
      const response = await axios.post(
        `${API_BASE_URL}/investor/applications`, 
        applicationData,
        { headers: { 'X-CSRF-Token': csrfToken } }
      );
      
      expect(response.data.success).to.be.true;
      expect(response.data.userId).to.exist;
      expect(response.data.token).to.exist;
      
      // Store user ID for later tests
      testInvestorId = response.data.userId;
    });

    it('should login as the investor', async function() {
      csrfToken = await getCsrfToken();
      
      const loginData = {
        email: TEST_INVESTOR.email,
        password: TEST_INVESTOR.password
      };
      
      const response = await axios.post(
        `${API_BASE_URL}/auth/login`,
        loginData,
        { 
          headers: { 'X-CSRF-Token': csrfToken },
          withCredentials: true
        }
      );
      
      expect(response.data.success).to.be.true;
      expect(response.data.user).to.exist;
      expect(response.data.user.role).to.equal('investor');
      
      if (response.headers['set-cookie']) {
        cookies = response.headers['set-cookie'];
      }
      
      // Get a new CSRF token with authenticated session
      csrfToken = await getCsrfToken();
    });
  });

  // Test investor profile
  describe('Investor Profile', function() {
    it('should get investor profile', async function() {
      const response = await makeAuthRequest('GET', '/investor/profile');
      
      expect(response.success).to.be.true;
      expect(response.profile).to.exist;
      expect(response.profile.userId).to.equal(testInvestorId);
    });

    it('should update investor profile', async function() {
      const profileData = {
        legalName: `${TEST_INVESTOR.firstName} ${TEST_INVESTOR.lastName}`,
        phone: TEST_INVESTOR.phone,
        address: '123 Test Street',
        city: 'Test City',
        state: 'TS',
        zipCode: '12345',
        country: 'United States',
        isAccredited: true
      };
      
      const response = await makeAuthRequest('POST', '/investor/profile', profileData);
      
      expect(response.success).to.be.true;
      expect(response.profile).to.exist;
      expect(response.profile.address).to.equal(profileData.address);
    });
  });

  // Test Plaid integration
  describe('Plaid Integration', function() {
    it('should create a Plaid link token', async function() {
      try {
        const response = await makeAuthRequest('POST', '/investor/plaid/create-link-token');
        
        expect(response.success).to.be.true;
        expect(response.linkToken).to.exist;
        expect(response.expiration).to.exist;
      } catch (error) {
        if (error.response?.status === 500) {
          console.log('Skipping Plaid test - API key likely not configured');
          this.skip();
        } else {
          throw error;
        }
      }
    });
  });

  // Test investment offerings
  describe('Investment Offerings', function() {
    it('should get available investment offerings', async function() {
      const response = await makeAuthRequest('GET', '/investor/offerings');
      
      expect(response.success).to.be.true;
      expect(response.offerings).to.be.an('array');
      
      if (response.offerings.length > 0) {
        testOfferingId = response.offerings[0].id;
      } else {
        // Create a test offering if none exist
        const offeringData = {
          name: 'Test Investment Offering',
          description: 'A test offering for automated tests',
          type: 'fixed_term_15_2yr',
          interestRate: 15,
          termMonths: 24,
          minimumInvestment: 10000,
          availableAmount: 1000000,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
        };
        
        // This requires admin access - would need to login as admin first
        try {
          const createResponse = await makeAuthRequest('POST', '/investor/offerings', offeringData);
          testOfferingId = createResponse.offering.id;
        } catch (error) {
          console.log('Could not create test offering - admin access required');
          if (response.offerings.length === 0) {
            this.skip();
          }
        }
      }
    });

    it('should get a specific investment offering', async function() {
      if (!testOfferingId) {
        this.skip();
      }
      
      const response = await makeAuthRequest('GET', `/investor/offerings/${testOfferingId}`);
      
      expect(response.success).to.be.true;
      expect(response.offering).to.exist;
      expect(response.offering.id).to.equal(testOfferingId);
    });
  });

  // Test document management
  describe('Document Management', function() {
    it('should get available documents', async function() {
      const response = await makeAuthRequest('GET', '/investor/documents');
      
      expect(response.success).to.be.true;
      expect(response.documents).to.be.an('array');
      
      if (response.documents.length > 0) {
        testDocumentId = response.documents[0].id;
      }
    });

    it('should get a specific document if available', async function() {
      if (!testDocumentId) {
        this.skip();
      }
      
      const response = await makeAuthRequest('GET', `/investor/documents/${testDocumentId}`);
      
      expect(response.success).to.be.true;
      expect(response.document).to.exist;
      expect(response.document.id).to.equal(testDocumentId);
      expect(response.downloadUrl).to.exist;
    });
  });

  // Test investments
  describe('Investments', function() {
    it('should make an investment', async function() {
      if (!testOfferingId) {
        this.skip();
      }
      
      const investmentData = {
        offeringId: testOfferingId,
        amount: 10000,
        agreementNumber: `TEST-${Date.now()}`
      };
      
      try {
        const response = await makeAuthRequest('POST', '/investor/investments', investmentData);
        
        expect(response.success).to.be.true;
        expect(response.investment).to.exist;
        expect(response.investment.offeringId).to.equal(testOfferingId);
        
        testInvestmentId = response.investment.id;
      } catch (error) {
        // If the investment fails because KYC not completed, that's expected
        if (error.response?.data?.message?.includes('KYC')) {
          console.log('Skipping investment test - KYC not completed');
          this.skip();
        } else {
          throw error;
        }
      }
    });

    it('should get all investments', async function() {
      const response = await makeAuthRequest('GET', '/investor/investments');
      
      expect(response.success).to.be.true;
      expect(response.investments).to.be.an('array');
    });

    it('should get a specific investment if available', async function() {
      if (!testInvestmentId) {
        this.skip();
      }
      
      const response = await makeAuthRequest('GET', `/investor/investments/${testInvestmentId}`);
      
      expect(response.success).to.be.true;
      expect(response.investment).to.exist;
      expect(response.investment.id).to.equal(testInvestmentId);
    });
  });

  // Test security
  describe('Security', function() {
    it('should reject requests without CSRF token', async function() {
      try {
        await axios.get(`${API_BASE_URL}/investor/profile`, { 
          headers: { 'Cookie': cookies },
          withCredentials: true
        });
        
        // Should not reach here - expect to throw an error
        expect.fail('Request without CSRF token should fail');
      } catch (error) {
        expect(error.response.status).to.equal(403);
      }
    });

    it('should reject requests with invalid CSRF token', async function() {
      try {
        await axios.get(`${API_BASE_URL}/investor/profile`, { 
          headers: { 
            'Cookie': cookies,
            'X-CSRF-Token': 'invalid-token'
          },
          withCredentials: true
        });
        
        // Should not reach here - expect to throw an error
        expect.fail('Request with invalid CSRF token should fail');
      } catch (error) {
        expect(error.response.status).to.equal(403);
      }
    });

    it('should reject access to admin endpoints', async function() {
      try {
        await makeAuthRequest('GET', '/admin/investors');
        
        // Should not reach here - expect to throw an error
        expect.fail('Investor should not access admin endpoints');
      } catch (error) {
        expect(error.response.status).to.equal(403);
      }
    });
  });

  // Cleanup after tests
  after(async function() {
    // Logout
    try {
      await makeAuthRequest('POST', '/auth/logout');
      console.log('Test cleanup completed - logged out test user');
    } catch (error) {
      console.error('After hook failed:', error);
    }
  });
});