import { useState, useEffect, useCallback } from 'react';
import { useLocation, useRouter } from 'wouter';

/**
 * Hook to manage URL search parameters
 * This provides a more convenient way to work with URL parameters than the native URLSearchParams
 */
export function useSearchParams<T extends Record<string, string | null>>() {
  const [location] = useLocation();
  const [, setLocation] = useRouter();
  const [params, setParams] = useState<T>({} as T);
  
  // Parse URL search params into state object
  useEffect(() => {
    const searchParams = new URLSearchParams(
      location.includes('?') ? location.split('?')[1] : ''
    );
    
    const parsedParams: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      parsedParams[key] = value;
    });
    
    setParams(parsedParams as T);
  }, [location]);
  
  // Update URL search params from state object
  const updateParams = useCallback((newParams: Partial<T>) => {
    const searchParams = new URLSearchParams(
      location.includes('?') ? location.split('?')[1] : ''
    );
    
    // Update or add new params
    Object.entries(newParams).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        searchParams.delete(key);
      } else {
        searchParams.set(key, String(value));
      }
    });
    
    // Get the base URL without search params
    const baseUrl = location.includes('?') 
      ? location.split('?')[0] 
      : location;
    
    // Create new URL with updated search params
    const newParamsString = searchParams.toString();
    const newUrl = newParamsString 
      ? `${baseUrl}?${newParamsString}` 
      : baseUrl;
    
    // Update URL without triggering a page reload
    setLocation(newUrl, { replace: true });
  }, [location, setLocation]);
  
  return { params, updateParams };
}