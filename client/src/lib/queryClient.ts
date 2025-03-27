import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { apiRequest } from "./api";
import { API_URL } from '../env';

// Re-export apiRequest to maintain backward compatibility
export { apiRequest };

// Helper to build full URL with API base URL if it's an API endpoint
function buildUrl(url: string): string {
  // If it's already an absolute URL, return it as is
  if (url.startsWith('http')) {
    return url;
  }
  
  // If it's an API call that starts with /api/, replace with full API URL
  if (url.startsWith('/api/')) {
    if (API_URL) {
      return `${API_URL}${url.substring(4)}`;
    }
    // Fall back to relative URL if API_URL is not available
    return url;
  }
  
  // For other relative URLs, use them as is
  return url;
}

// Proper error handling for API responses
async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    try {
      // First try to parse as JSON
      const errorData = await res.json();
      const errorMessage = errorData.message || errorData.error || JSON.stringify(errorData);
      throw new Error(`${res.status}: ${errorMessage}`);
    } catch (e) {
      // Fall back to plain text
      const text = (await res.text()) || res.statusText;
      throw new Error(`${res.status}: ${text}`);
    }
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = buildUrl(queryKey[0] as string);
    
    // Log API requests in development for debugging
    if (import.meta.env.DEV) {
      console.log(`Query request to: ${url} (original: ${queryKey[0]})`);
    }
    
    // Get auth token from local storage
    const headers: Record<string, string> = {};
    
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
    
    const res = await fetch(url, {
      credentials: "include",
      headers
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
