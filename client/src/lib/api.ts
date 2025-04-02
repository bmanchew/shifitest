import { QueryFunction } from "@tanstack/react-query";
import { API_URL } from '../env';
import * as csrfUtils from './csrf';
import { extractApiErrorMessage, isCsrfError, isSessionExpiredError } from './errorHandling';

/**
 * API utility functions for the application
 */

// Helper to build full URL with API base URL if it's an API endpoint
export function buildUrl(url: string): string {
  // If it's already an absolute URL, return it as is
  if (url.startsWith('http')) {
    return url;
  }
  
  // If it's an API call that starts with /api/
  if (url.startsWith('/api/')) {
    // For API URLs, we need to ensure consistent handling
    // First, check if API_URL is available
    if (API_URL) {
      // Check if API_URL already ends with /api
      if (API_URL.endsWith('/api')) {
        // API_URL already includes /api, so we only need the path after /api/
        return `${API_URL}${url.substring(4)}`;
      } else {
        // API_URL doesn't include /api, so we keep the full path
        return `${API_URL}${url}`;
      }
    }
    
    // Fall back to relative URL if API_URL is not available
    // This will use the current origin as base
    console.log(`API_URL not available, using relative URL: ${url}`);
    return url;
  }
  
  // For other relative URLs, use them as is (relative to current domain)
  return url;
}

// Handle error responses from API
export async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    try {
      // First try to parse as JSON (most of our API endpoints return JSON errors)
      const errorData = await res.json();
      
      // Create an error object with the full response data for better error handling
      const error = new Error(errorData.message || errorData.error || JSON.stringify(errorData));
      
      // Attach the API response data to the error object
      (error as any).response = {
        status: res.status,
        statusText: res.statusText,
        data: errorData
      };
      
      // Attach error code if available
      if (errorData.errorCode) {
        (error as any).code = errorData.errorCode;
      }
      
      throw error;
    } catch (e) {
      // If parsing as JSON fails or the error is already thrown from above
      if (e instanceof SyntaxError) {
        // JSON parsing failed, fall back to plain text
        const text = await res.text() || res.statusText;
        const error = new Error(`${res.status}: ${text}`);
        (error as any).response = {
          status: res.status,
          statusText: res.statusText,
          data: { message: text }
        };
        throw error;
      }
      
      // Re-throw the error from the JSON block
      throw e;
    }
  }
}

/**
 * Enhanced API request function with improved error handling and retry logic
 */
export async function apiRequest<T = Response>(
  method: string,
  url: string,
  data?: unknown | undefined,
  customHeaders?: Record<string, string> | null,
  options: {
    retry?: boolean;
    maxRetries?: number;
    retryDelay?: number;
  } = {},
): Promise<T> {
  const { 
    retry = true, 
    maxRetries = 3, 
    retryDelay = 500 
  } = options;
  
  const fullUrl = buildUrl(url);
  
  // Log API requests in development for debugging
  if (import.meta.env.DEV) {
    console.log(`API Request: ${method} ${fullUrl}`);
    if (data) console.log(`Request data:`, data);
    if (customHeaders) console.log(`Custom headers:`, customHeaders);
  }

  // Get auth token from local storage
  let headers: Record<string, string> = data ? { "Content-Type": "application/json" } : {};
  
  // Add any custom headers if provided
  if (customHeaders) {
    headers = { ...headers, ...customHeaders };
  }
  
  // Add authentication token if available
  try {
    const userData = localStorage.getItem("shifi_user");
    if (userData) {
      const user = JSON.parse(userData);
      if (user.token) {
        headers['Authorization'] = `Bearer ${user.token}`;
      }
    }
  } catch (error) {
    console.error("Error getting auth token from localStorage:", error);
  }
  
  // For non-GET requests to API endpoints, add CSRF token
  if (method !== 'GET' && url.startsWith('/api') && !url.includes('/webhook')) {
    // List of endpoints that don't need CSRF protection
    const excludedCsrfEndpoints = [
      '/api/auth/login', 
      '/api/auth/register',
      '/api/auth/reset-password',
      '/api/auth/forgot-password',
      '/api/investor/applications',  // Investor application submission endpoint
      '/api/communications',         // Communications endpoints
      '/api/conversations',          // Conversation endpoints (backward compatibility)
      '/api/support-tickets'         // Support tickets endpoints
    ];
    
    const shouldAddCsrf = !excludedCsrfEndpoints.some(endpoint => url.startsWith(endpoint));
    
    if (shouldAddCsrf) {
      try {
        // Add CSRF token to headers for state-changing requests
        const headersWithCsrf = await csrfUtils.addCsrfHeader(headers);
        Object.assign(headers, headersWithCsrf);
        
        if (import.meta.env.DEV) {
          console.log(`Added CSRF token to request headers for ${url}`);
        }
      } catch (error) {
        console.error('Failed to add CSRF token to request:', error);
      }
    } else if (import.meta.env.DEV) {
      console.log(`Skipping CSRF token for excluded endpoint: ${url}`);
    }
  }
  
  // Function to perform the actual fetch request
  const performFetch = async (attempt = 1): Promise<T> => {
    try {
      const res = await fetch(fullUrl, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
        credentials: "include",
      });
      
      // Check for CSRF token errors specifically - these are special because they can be resolved by refreshing the token
      if (res.status === 403) {
        try {
          // Try to parse as JSON first
          const responseData = await res.json();
          
          // Construct an error object with the response data for proper error detection
          const csrfError = new Error(responseData.message || 'Forbidden');
          (csrfError as any).response = {
            status: res.status,
            statusText: res.statusText,
            data: responseData
          };
          
          // Check if this is a CSRF error
          if (isCsrfError(csrfError) && attempt <= maxRetries) {
            console.warn(`CSRF token error detected (attempt ${attempt}/${maxRetries}), refreshing token and retrying...`);
            
            // Clear the cached token and force a fresh fetch
            csrfUtils.clearCsrfToken();
            
            // Update headers with a new CSRF token
            if (method !== 'GET') {
              const freshCsrfHeaders = await csrfUtils.addCsrfHeader(headers);
              Object.assign(headers, freshCsrfHeaders);
            }
            
            // Wait before retrying with exponential backoff
            const backoffDelay = retryDelay * Math.pow(2, attempt - 1);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
            
            // Retry the request
            return performFetch(attempt + 1);
          }
          
          // If it's not a CSRF error or we've exceeded retries, throw the error
          throw csrfError;
        } catch (e) {
          // If JSON parsing fails, fallback to text response
          if (e instanceof SyntaxError) {
            const responseText = await res.text();
            
            // Check for CSRF in the text
            if (responseText.includes('CSRF') && attempt <= maxRetries) {
              console.warn(`CSRF token error detected (attempt ${attempt}/${maxRetries}), refreshing token and retrying...`);
              
              // Clear the cached token and force a fresh fetch
              csrfUtils.clearCsrfToken();
              
              // Update headers with a new CSRF token
              if (method !== 'GET') {
                const freshCsrfHeaders = await csrfUtils.addCsrfHeader(headers);
                Object.assign(headers, freshCsrfHeaders);
              }
              
              // Wait before retrying with exponential backoff
              const backoffDelay = retryDelay * Math.pow(2, attempt - 1);
              await new Promise(resolve => setTimeout(resolve, backoffDelay));
              
              // Retry the request
              return performFetch(attempt + 1);
            }
            
            // Not a CSRF error or exceeded retries
            const error = new Error(`Forbidden: ${responseText}`);
            (error as any).response = {
              status: res.status,
              statusText: res.statusText,
              data: { message: responseText }
            };
            throw error;
          }
          
          // Re-throw the error from JSON parsing
          throw e;
        }
      }
      
      // Handle authentication errors specifically (session expired)
      if (res.status === 401) {
        try {
          // Try to parse as JSON first
          const responseData = await res.json();
          
          // Construct an error object with the response data
          const authError = new Error(responseData.message || 'Unauthorized');
          (authError as any).response = {
            status: res.status,
            statusText: res.statusText,
            data: responseData
          };
          
          // Check if this is a session expired error
          if (isSessionExpiredError(authError)) {
            // Log the session expiration
            console.warn('Session expired. User needs to log in again.');
            
            // Create an event for session expiration that components can listen for
            window.dispatchEvent(new CustomEvent('session-expired'));
            
            // Clear auth from localStorage
            try {
              localStorage.removeItem('shifi_user');
            } catch (e) {
              console.error('Failed to clear user data from localStorage:', e);
            }
          }
          
          // Throw the error to be handled by the caller
          throw authError;
        } catch (e) {
          // If JSON parsing fails or we re-throw from above
          if (!(e instanceof SyntaxError)) {
            throw e;
          }
          
          // JSON parsing failed, fall back to text
          const responseText = await res.text();
          const error = new Error(`Unauthorized: ${responseText}`);
          (error as any).response = {
            status: res.status,
            statusText: res.statusText,
            data: { message: responseText }
          };
          throw error;
        }
      }
      
      // Handle network errors that may benefit from retries
      if (!res.ok && retry && attempt <= maxRetries && (res.status >= 500 || res.status === 429)) {
        console.warn(`Request failed with status ${res.status} (attempt ${attempt}/${maxRetries}), retrying...`);
        
        // Wait before retrying with exponential backoff
        const backoffDelay = retryDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        
        // Retry the request
        return performFetch(attempt + 1);
      }
      
      // For other errors, proceed with normal error handling
      await throwIfResNotOk(res);
      
      // If T is Response (the default), just return the response object
      if (method === "HEAD" || method === "DELETE" || res.status === 204) {
        return res as unknown as T;
      }
      
      // Otherwise, parse as JSON
      return (await res.json()) as T;
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('network') && retry && attempt <= maxRetries) {
        // Network errors (like connection refused) can benefit from retries
        console.warn(`Network error (attempt ${attempt}/${maxRetries}), retrying...`, error);
        
        // Wait before retrying with exponential backoff
        const backoffDelay = retryDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        
        // Retry the request
        return performFetch(attempt + 1);
      }
      
      // Re-throw all other errors
      throw error;
    }
  };
  
  // Start the fetch process with the first attempt
  return performFetch();
}

// Create a query function that uses apiRequest
export const createApiQuery = <T>(
  url: string,
  method: string = "GET",
  data?: unknown,
  customHeaders?: Record<string, string>
): QueryFunction<T> => {
  return async () => {
    return apiRequest<T>(method, url, data, customHeaders);
  };
};

/**
 * Fetch payment schedule data for a customer
 * @param customerId - The ID of the customer
 * @param customHeaders - Optional custom headers to include with the request
 * @returns Promise with the payment schedule data
 */
export const fetchPaymentSchedule = async (customerId: string, customHeaders?: Record<string, string>) => {
  return apiRequest('GET', `/api/customers/${customerId}/payment-schedule`, undefined, customHeaders);
};

/**
 * Update payment schedule for a customer
 * @param customerId - The ID of the customer
 * @param scheduleData - The updated schedule data
 * @param customHeaders - Optional custom headers to include with the request
 * @returns Promise with the updated payment schedule
 */
export const updatePaymentSchedule = async (customerId: string, scheduleData: any, customHeaders?: Record<string, string>) => {
  return apiRequest('PUT', `/api/customers/${customerId}/payment-schedule`, scheduleData, customHeaders);
};