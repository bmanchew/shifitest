import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { apiRequest } from "./api";

// Re-export apiRequest to maintain backward compatibility
export { apiRequest };

// Get API base URL from environment variables, defaulting to relative URLs if not available
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Helper to build full URL with API base URL if it's an API endpoint
function buildUrl(url: string): string {
  // If it's already an absolute URL or API_BASE_URL is not set, return it as is
  if (url.startsWith('http') || !API_BASE_URL) {
    return url;
  }
  
  // If it's an API call that already includes /api, add the API base URL
  if (url.startsWith('/api/')) {
    // Replace /api/ with the full API base URL
    return `${API_BASE_URL}${url.substring(4)}`;
  }
  
  // For other relative URLs, use them as is (relative to current domain)
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
    console.log(`Making API request to: ${url} (original: ${queryKey[0]})`);
    
    const res = await fetch(url, {
      credentials: "include",
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
