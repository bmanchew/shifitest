/**
 * CSRF token handling utilities for secure API requests
 * Improved with retry logic and more robust error handling
 */

// Store the token in memory
let csrfToken: string | null = null;
// Track token fetch attempts
let fetchingToken = false;
let fetchRetryCount = 0;
const MAX_RETRIES = 3;
// Keep track of when the token was fetched
let tokenFetchTime: number | null = null;
const TOKEN_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Fetch a CSRF token from the server with retry logic
 */
export const fetchCsrfToken = async (): Promise<string> => {
  try {
    // Mark that we're currently fetching a token to prevent duplicate fetches
    fetchingToken = true;
    
    // Add a random query parameter to prevent caching
    const cacheBuster = `_=${Date.now()}`;
    const response = await fetch(`/api/csrf-token?${cacheBuster}`, {
      method: 'GET',
      credentials: 'include', // Include cookies in the request
      cache: 'no-cache', // Prevent caching
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache, no-store',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) {
      if (fetchRetryCount < MAX_RETRIES) {
        fetchRetryCount++;
        console.warn(`Failed to fetch CSRF token (attempt ${fetchRetryCount}/${MAX_RETRIES}), retrying...`);
        fetchingToken = false;
        
        // Exponential backoff
        const delay = 500 * Math.pow(2, fetchRetryCount - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return fetchCsrfToken();
      }
      
      throw new Error(`Failed to fetch CSRF token after ${MAX_RETRIES} attempts: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.success || !data.csrfToken) {
      throw new Error('Invalid CSRF token response format');
    }
    
    // Reset retry count on success
    fetchRetryCount = 0;
    // Store the token and when we fetched it
    csrfToken = data.csrfToken;
    tokenFetchTime = Date.now();
    
    if (import.meta.env.DEV && csrfToken) {
      // Only show first few characters of token for security
      const tokenPreview = csrfToken.length > 8 ? 
        `${csrfToken.substring(0, 8)}...` : 
        '[token too short]';
      console.log(`Successfully obtained CSRF token: ${tokenPreview}`);
    }
    
    return data.csrfToken;
  } catch (error) {
    console.error('Error fetching CSRF token:', error);
    throw error;
  } finally {
    fetchingToken = false;
  }
};

/**
 * Check if the token has expired and needs to be refreshed
 */
const isTokenExpired = (): boolean => {
  if (!tokenFetchTime) return true;
  
  const now = Date.now();
  const elapsed = now - tokenFetchTime;
  return elapsed > TOKEN_EXPIRY_MS;
};

/**
 * Get the current CSRF token, fetching it if necessary
 * Uses a mutex-like pattern to prevent multiple simultaneous fetches
 */
export const getCsrfToken = async (): Promise<string> => {
  // If we already have a token that's not expired, return it
  if (csrfToken && !isTokenExpired()) {
    return csrfToken;
  }
  
  // If a fetch is already in progress, wait for it to complete
  if (fetchingToken) {
    // Poll until fetchingToken is false or we get a token
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (!fetchingToken && csrfToken) {
        return csrfToken;
      }
    }
    // If we time out waiting, just try to fetch it again
  }
  
  // Otherwise fetch a new token
  return fetchCsrfToken();
};

/**
 * Add CSRF token to request headers with both standard formats
 */
export const addCsrfHeader = async (headers: HeadersInit = {}): Promise<HeadersInit> => {
  try {
    const token = await getCsrfToken();
    
    // Add token in both formats for compatibility
    return {
      ...headers,
      'CSRF-Token': token,
      'X-CSRF-Token': token,
    };
  } catch (error) {
    console.error('Failed to add CSRF token to headers:', error);
    // Return original headers if token fetch fails
    return headers;
  }
};

/**
 * Clear the stored CSRF token (e.g., on logout)
 */
export const clearCsrfToken = (): void => {
  csrfToken = null;
  tokenFetchTime = null;
  fetchRetryCount = 0;
};