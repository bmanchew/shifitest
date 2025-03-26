import { useLocation } from "wouter";
import { useMemo } from "react";

/**
 * Custom hook to get and manipulate URL search parameters
 * @returns Object with searchParams and utility functions
 */
export function useSearchParams() {
  const [location, setLocation] = useLocation();
  
  // Parse current search params from URL
  const searchParams = useMemo(() => {
    const url = new URL(window.location.href);
    return url.searchParams;
  }, [location]);
  
  /**
   * Update a single search parameter
   * @param key Parameter key to update
   * @param value New value (undefined to remove)
   */
  const setParam = (key: string, value: string | undefined) => {
    const url = new URL(window.location.href);
    
    if (value === undefined) {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, value);
    }
    
    // Update the location using wouter's setLocation
    setLocation(url.pathname + url.search);
  };
  
  /**
   * Update multiple search parameters at once
   * @param params Object with key-value pairs to update
   */
  const setParams = (params: Record<string, string | undefined>) => {
    const url = new URL(window.location.href);
    
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined) {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, value);
      }
    });
    
    // Update the location using wouter's setLocation
    setLocation(url.pathname + url.search);
  };
  
  /**
   * Get a specific parameter value
   * @param key Parameter key to retrieve
   * @returns Parameter value or null if not present
   */
  const getParam = (key: string): string | null => {
    return searchParams.get(key);
  };
  
  /**
   * Remove all search parameters and reset URL
   */
  const clearParams = () => {
    setLocation(window.location.pathname);
  };
  
  return {
    searchParams,
    setParam,
    setParams,
    getParam,
    clearParams
  };
}

export default useSearchParams;