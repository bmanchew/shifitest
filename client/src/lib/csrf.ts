/**
 * CSRF token handling utilities for secure API requests
 */

// Store the token in memory
let csrfToken: string | null = null;

/**
 * Fetch a CSRF token from the server
 */
export const fetchCsrfToken = async (): Promise<string> => {
  try {
    const response = await fetch('/api/csrf-token', {
      method: 'GET',
      credentials: 'include', // Include cookies in the request
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch CSRF token: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.success || !data.csrfToken) {
      throw new Error('Invalid CSRF token response');
    }
    
    // Store the token
    csrfToken = data.csrfToken;
    return data.csrfToken;
  } catch (error) {
    console.error('Error fetching CSRF token:', error);
    throw error;
  }
};

/**
 * Get the current CSRF token, fetching it if necessary
 */
export const getCsrfToken = async (): Promise<string> => {
  if (!csrfToken) {
    return fetchCsrfToken();
  }
  return csrfToken;
};

/**
 * Add CSRF token to request headers
 */
export const addCsrfHeader = async (headers: HeadersInit = {}): Promise<HeadersInit> => {
  const token = await getCsrfToken();
  return {
    ...headers,
    'CSRF-Token': token,
  };
};

/**
 * Clear the stored CSRF token (e.g., on logout)
 */
export const clearCsrfToken = (): void => {
  csrfToken = null;
};