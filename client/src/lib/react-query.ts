import { QueryClient } from '@tanstack/react-query';

// Create a client
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (previously cacheTime in v4)
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      refetchOnReconnect: true,
    },
  },
});

/**
 * Utility function for making API requests with proper error handling and type safety
 * @param method HTTP method (GET, POST, PUT, DELETE)
 * @param url API endpoint URL
 * @param data Request payload (for POST, PUT)
 * @returns Promise with typed response data
 */
export async function apiRequest<T = any>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  url: string,
  data?: any
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  // For CSRF protected routes, include the CSRF token if available
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  const options: RequestInit = {
    method,
    headers,
    credentials: 'include', // Include cookies for authentication
  };

  if (data && method !== 'GET') {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);

  // Handle non-2xx responses
  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `API Error (${response.status}): ${response.statusText}`;
    
    try {
      // Try to parse error as JSON
      const errorData = JSON.parse(errorText);
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch (e) {
      // If not JSON, use the raw text
      if (errorText) {
        errorMessage = errorText;
      }
    }
    
    const error = new Error(errorMessage);
    (error as any).status = response.status;
    (error as any).statusText = response.statusText;
    (error as any).url = url;
    throw error;
  }

  // Handle empty responses (like 204 No Content)
  if (response.status === 204) {
    return {} as T;
  }

  // Parse JSON response
  try {
    return await response.json() as T;
  } catch (error) {
    console.error('Failed to parse JSON response', error);
    throw new Error(`Failed to parse API response: ${error instanceof Error ? error.message : String(error)}`);
  }
}