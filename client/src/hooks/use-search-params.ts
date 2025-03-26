import { useCallback, useMemo } from "react";
import { useLocation, useRoute } from "wouter";

/**
 * A hook for working with URL search parameters in React components.
 * Provides utility functions to get, set, and clear search parameters.
 */
export function useSearchParams() {
  const [location, setLocation] = useLocation();

  // Extract search params from the URL
  const searchParams = useMemo(() => {
    const url = new URL(location, window.location.origin);
    return url.searchParams;
  }, [location]);

  /**
   * Set a single search parameter in the URL
   * @param key The parameter key
   * @param value The parameter value, undefined to remove
   */
  const setParam = useCallback(
    (key: string, value: string | undefined) => {
      const url = new URL(location, window.location.origin);
      
      if (value === undefined) {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, value);
      }
      
      setLocation(url.pathname + url.search);
    },
    [location, setLocation]
  );

  /**
   * Set multiple search parameters at once
   * @param params Object with key-value pairs to set in URL
   */
  const setParams = useCallback(
    (params: Record<string, string | undefined>) => {
      const url = new URL(location, window.location.origin);
      
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined) {
          url.searchParams.delete(key);
        } else {
          url.searchParams.set(key, value);
        }
      }
      
      setLocation(url.pathname + url.search);
    },
    [location, setLocation]
  );

  /**
   * Get a single search parameter value
   * @param key The parameter key
   * @returns The parameter value or null if not present
   */
  const getParam = useCallback(
    (key: string): string | null => {
      return searchParams.get(key);
    },
    [searchParams]
  );

  /**
   * Clear all search parameters
   */
  const clearParams = useCallback(() => {
    setLocation(location.split("?")[0]);
  }, [location, setLocation]);

  return {
    searchParams,
    setParam,
    setParams,
    getParam,
    clearParams,
  };
}