import { QueryFunction } from "@tanstack/react-query";
import { API_URL } from '../env';
import * as csrfUtils from './csrf';

/**
 * API utility functions for the application
 */

// Helper to build full URL with API base URL if it's an API endpoint
export function buildUrl(url: string): string {
  // If it's already an absolute URL, return it as is
  if (url.startsWith('http')) {
    return url;
  }
  
  // If it's an API call that starts with /api/, replace it with the full API URL
  if (url.startsWith('/api/')) {
    if (API_URL) {
      return `${API_URL}${url.substring(4)}`;
    }
    // Fall back to relative URL if API_URL is not available
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
      const errorMessage =
        errorData.message || errorData.error || JSON.stringify(errorData);
      throw new Error(`${res.status}: ${errorMessage}`);
    } catch (e) {
      // If parsing as JSON fails, fall back to plain text
      const text = (await res.text()) || res.statusText;
      throw new Error(`${res.status}: ${text}`);
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
  }

  // Get auth token from local storage
  let headers: Record<string, string> = data ? { "Content-Type": "application/json" } : {};
  
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
      '/api/auth/forgot-password'
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
        const responseText = await res.text();
        
        // If it's a CSRF token error, refresh the token and retry the request
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
        
        // If it's not a CSRF error or we've exceeded retries, throw the error
        throw new Error(`Forbidden: ${responseText}`);
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
  data?: unknown
): QueryFunction<T> => {
  return async () => {
    return apiRequest<T>(method, url, data);
  };
};

/**
 * Fetch payment schedule data for a customer
 * @param customerId - The ID of the customer
 * @returns Promise with the payment schedule data
 */
export const fetchPaymentSchedule = async (customerId: string) => {
  const response = await fetch(`/api/customers/${customerId}/payment-schedule`);
  if (!response.ok) {
    throw new Error(`Failed to fetch payment schedule: ${response.statusText}`);
  }
  return response.json();
};

/**
 * Update payment schedule for a customer
 * @param customerId - The ID of the customer
 * @param scheduleData - The updated schedule data
 * @returns Promise with the updated payment schedule
 */
export const updatePaymentSchedule = async (customerId: string, scheduleData: any) => {
  const response = await fetch(`/api/customers/${customerId}/payment-schedule`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(scheduleData),
  });
  if (!response.ok) {
    throw new Error(`Failed to update payment schedule: ${response.statusText}`);
  }
  return response.json();
};