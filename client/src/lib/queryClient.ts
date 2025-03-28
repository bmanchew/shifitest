import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { apiRequest, buildUrl, throwIfResNotOk } from "./api";

// Re-export apiRequest to maintain backward compatibility
export { apiRequest };

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