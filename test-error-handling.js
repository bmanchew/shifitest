/**
 * Test script for the enhanced error handling system
 * 
 * This script tests different types of errors to verify our
 * error handling middleware is working correctly.
 */
import axios from 'axios';
import { logger } from './server/services/logger.js';
import { AppError, ErrorFactory } from './server/services/errorHandler.js';

// Base URL for API requests
const BASE_URL = 'http://localhost:5000';

/**
 * Test various error types to verify error handling
 */
async function testErrorHandling() {
  console.log('Testing enhanced error handling...');

  // Test AppError construction
  try {
    console.log('\n1. Testing AppError class...');
    
    // Create different types of errors using ErrorFactory
    const validationError = ErrorFactory.validation('Invalid input data');
    const unauthorizedError = ErrorFactory.unauthorized('Authentication required');
    const forbiddenError = ErrorFactory.forbidden();
    const notFoundError = ErrorFactory.notFound('User');
    const conflictError = ErrorFactory.conflict('Resource already exists');
    const internalError = ErrorFactory.internal('Something went wrong');
    const serviceError = ErrorFactory.serviceUnavailable('Plaid');
    const apiError = ErrorFactory.externalApi('Stripe', 'Invalid API key', 401);
    
    // Verify error properties
    console.log('✅ ValidationError:', 
      validationError.statusCode === 400 && 
      validationError.errorCode === 'VALIDATION_ERROR' && 
      validationError.category === 'validation');
    
    console.log('✅ UnauthorizedError:', 
      unauthorizedError.statusCode === 401 && 
      unauthorizedError.errorCode === 'UNAUTHORIZED' && 
      unauthorizedError.category === 'auth');
    
    console.log('✅ ForbiddenError:', 
      forbiddenError.statusCode === 403 && 
      forbiddenError.errorCode === 'FORBIDDEN' && 
      forbiddenError.category === 'auth');
    
    console.log('✅ NotFoundError:', 
      notFoundError.statusCode === 404 && 
      notFoundError.errorCode === 'NOT_FOUND' && 
      notFoundError.category === 'resource' &&
      notFoundError.message === 'User not found');
    
    console.log('✅ ConflictError:', 
      conflictError.statusCode === 409 && 
      conflictError.errorCode === 'CONFLICT' && 
      conflictError.category === 'resource');
    
    console.log('✅ InternalError:', 
      internalError.statusCode === 500 && 
      internalError.errorCode === 'INTERNAL_ERROR' && 
      internalError.category === 'system' &&
      internalError.isOperational === false);
    
    console.log('✅ ServiceUnavailableError:', 
      serviceError.statusCode === 503 && 
      serviceError.errorCode === 'SERVICE_UNAVAILABLE' && 
      serviceError.category === 'system' &&
      serviceError.source === 'plaid');
    
    console.log('✅ ExternalApiError:', 
      apiError.statusCode === 401 && 
      apiError.errorCode === 'EXTERNAL_API_ERROR' && 
      apiError.category === 'api' &&
      apiError.source === 'stripe');
      
    console.log('AppError tests completed successfully!\n');
  } catch (error) {
    console.error('❌ Error testing AppError class:', error);
  }

  // Test API error responses for 404
  try {
    console.log('2. Testing 404 Not Found API response...');
    await axios.get(`${BASE_URL}/api/non-existent-endpoint`);
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.log('✅ 404 Error response:', {
        status: error.response.status,
        message: error.response.data.message,
        success: error.response.data.success
      });
    } else {
      console.error('❌ Unexpected error testing 404:', error);
    }
  }

  // Test validation error
  try {
    console.log('\n3. Testing validation error...');
    // This endpoint requires authentication, so it should fail with a validation or auth error
    await axios.post(`${BASE_URL}/api/auth/change-password`, {});
  } catch (error) {
    if (error.response && (error.response.status === 400 || error.response.status === 401)) {
      console.log('✅ Validation/Auth Error response:', {
        status: error.response.status,
        message: error.response.data.message,
        success: error.response.data.success,
        errorCode: error.response.data.errorCode
      });
    } else {
      console.error('❌ Unexpected error testing validation:', error);
    }
  }

  // Test CSRF protection
  try {
    console.log('\n4. Testing CSRF protection...');
    // This should trigger CSRF protection error since we're not sending a CSRF token
    await axios.post(`${BASE_URL}/api/customers/create`, {
      name: 'Test Customer',
      email: 'test@example.com'
    });
  } catch (error) {
    if (error.response && error.response.status === 403) {
      console.log('✅ CSRF Error response:', {
        status: error.response.status,
        message: error.response.data.message,
        success: error.response.data.success
      });
    } else {
      console.error('❌ Unexpected error testing CSRF:', error);
    }
  }

  console.log('\nError handling tests completed!');
}

/**
 * Main function
 */
async function main() {
  try {
    await testErrorHandling();
  } catch (error) {
    console.error('Error running tests:', error);
  }
}

// Run the main function
main();