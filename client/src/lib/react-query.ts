/**
 * React Query configuration and API request utilities
 * 
 * This module provides a centralized configuration for React Query,
 * including proper caching, error handling, and standardized API requests.
 */
import { 
  QueryClient, 
  DefaultOptions, 
  QueryClientConfig,
  MutationOptions
} from '@tanstack/react-query';
import axios, { AxiosRequestConfig, AxiosError } from 'axios';
import { toast } from '@/hooks/use-toast';

// Default API base URL
const API_BASE_URL = '/api';

// Default stale time - reduce refetches for improved performance
const DEFAULT_STALE_TIME = 30 * 1000; // 30 seconds

// Default cache time - keep data in cache longer for performance
const DEFAULT_CACHE_TIME = 5 * 60 * 1000; // 5 minutes

// Default React Query options to be applied to all queries
const defaultOptions: DefaultOptions = {
  queries: {
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME,
    refetchOnWindowFocus: false, // Disable refetching on window focus for improved performance
    retry: (failureCount, error) => {
      // Only retry network errors, not 4xx or 5xx responses
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        // Don't retry if we received a response (4xx or 5xx)
        return false;
      }
      
      // Retry network errors up to 2 times
      return failureCount < 2;
    },
    // Default error handler that shows toast on errors
    onError: (error: unknown) => {
      const axiosError = error as AxiosError;
      const errorMessage = axiosError.response?.data?.message || 
                           axiosError.message || 
                           'An error occurred';

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  },
  mutations: {
    // Default error handler for mutations
    onError: (error: unknown) => {
      const axiosError = error as AxiosError;
      const errorMessage = axiosError.response?.data?.message || 
                           axiosError.message || 
                           'An error occurred while saving changes';

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    },
    // Default success handler for mutations
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Changes saved successfully',
        variant: 'default',
      });
    }
  }
};

// Create React Query client with default settings
export const queryClientConfig: QueryClientConfig = {
  defaultOptions
};

export const queryClient = new QueryClient(queryClientConfig);

// API request utility for consistent error handling and response formatting
interface ApiRequestOptions extends AxiosRequestConfig {
  showSuccessToast?: boolean;
  successMessage?: string;
  showErrorToast?: boolean;
  errorMessage?: string;
}

/**
 * Helper function to make API requests with consistent error handling,
 * response formatting, and automatically handles CSRF tokens
 * 
 * @param options Extended axios request config
 * @returns Promise resolving to response data
 */
export const apiRequest = async <T = any>(options: ApiRequestOptions): Promise<T> => {
  try {
    // Default to API base URL if not specified
    const url = options.url?.startsWith('http') 
      ? options.url 
      : `${API_BASE_URL}${options.url}`;
    
    // Make the request
    const response = await axios({
      ...options,
      url,
      // Ensure cookies are included (for CSRF and authentication)
      withCredentials: true
    });
    
    // Show success toast if enabled
    if (options.showSuccessToast) {
      toast({
        title: 'Success',
        description: options.successMessage || 'Operation completed successfully',
        variant: 'default',
      });
    }
    
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    const errorMessage = (axiosError.response?.data as any)?.message || 
                         axiosError.message || 
                         options.errorMessage || 
                         'An error occurred';
    
    // Show error toast if enabled
    if (options.showErrorToast !== false) {
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
    
    // Rethrow for proper error handling
    throw error;
  }
};

/**
 * Creates mutation options with proper typing for TanStack Query
 */
export function createMutationOptions<TData, TError, TVariables, TContext>(
  options: MutationOptions<TData, TError, TVariables, TContext>
): MutationOptions<TData, TError, TVariables, TContext> {
  return options;
}

export default queryClient;