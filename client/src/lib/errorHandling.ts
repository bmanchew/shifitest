/**
 * Enhanced client-side error handling utilities
 * 
 * This module provides utilities for handling errors in the client application,
 * with special handling for API errors, validation errors, and other common error types.
 */
import { toast } from '@/hooks/use-toast';
import { z } from 'zod';

// Generic API error response structure
export interface ApiErrorResponse {
  success: boolean;
  status: number;
  message: string;
  errorCode?: string;
  errors?: any[];
}

/**
 * Extract error message from Zod validation errors
 * @param error Zod validation error
 * @returns Formatted error message
 */
export const extractZodErrorMessage = (error: z.ZodError): string => {
  const formattedErrors = error.errors.map(err => {
    const path = err.path.join('.');
    return `${path ? `${path}: ` : ''}${err.message}`;
  });
  
  return formattedErrors.join('; ');
};

/**
 * Display a toast notification for an error
 * @param error Error object or message
 * @param title Custom title for the toast (optional)
 */
export const showErrorToast = (error: unknown, title?: string): void => {
  let message = 'An unexpected error occurred';
  let errorTitle = title || 'Error';
  
  // Handle different types of errors
  if (typeof error === 'string') {
    message = error;
  } else if (error instanceof Error) {
    message = error.message;
  } else if (error instanceof z.ZodError) {
    message = extractZodErrorMessage(error);
    errorTitle = 'Validation Error';
  } else if (error && typeof error === 'object' && 'message' in error) {
    message = String((error as any).message);
  }
  
  // Show the toast notification
  toast({
    title: errorTitle,
    description: message,
    variant: 'destructive',
  });
};

/**
 * Extract a user-friendly error message from an API error response
 * @param error Error object from API call
 * @returns Formatted error message
 */
export const extractApiErrorMessage = (error: unknown): string => {
  // Default error message
  let message = 'An unexpected error occurred';
  
  // Check if this is an Axios error
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as any).response;
    
    if (response && typeof response === 'object') {
      // Handle API error response
      if (response.data && typeof response.data === 'object') {
        const apiError = response.data as ApiErrorResponse;
        
        if (apiError.message) {
          message = apiError.message;
        }
        
        // Add validation errors if present
        if (apiError.errors && Array.isArray(apiError.errors) && apiError.errors.length > 0) {
          const validationMessages = apiError.errors.join('; ');
          message = `${message}: ${validationMessages}`;
        }
      } else if (response.statusText) {
        // Use status text if data is not available
        message = `Error: ${response.statusText}`;
      }
    }
  } else if (error instanceof Error) {
    // Handle standard Error objects
    message = error.message;
  } else if (typeof error === 'string') {
    // Handle string errors
    message = error;
  }
  
  return message;
};

/**
 * Handle API errors in a consistent way
 * @param error Error object from API call
 * @param fallbackMessage Fallback message if error cannot be parsed
 * @returns Formatted error message
 */
export const handleApiError = (error: unknown, fallbackMessage = 'An unexpected error occurred'): string => {
  const errorMessage = extractApiErrorMessage(error);
  
  // Show a toast notification with the error
  showErrorToast(errorMessage);
  
  // Return the error message for further processing if needed
  return errorMessage || fallbackMessage;
};

/**
 * Error handler for API mutations
 * @param error Error from mutation
 * @param options Additional options
 */
export const handleMutationError = (
  error: unknown, 
  options: {
    fallbackMessage?: string;
    title?: string;
    silent?: boolean;
  } = {}
): string => {
  const { fallbackMessage = 'Failed to perform operation', title, silent = false } = options;
  
  const errorMessage = extractApiErrorMessage(error) || fallbackMessage;
  
  if (!silent) {
    showErrorToast(errorMessage, title);
  }
  
  // Log the full error to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Mutation error:', error);
  }
  
  return errorMessage;
};

/**
 * Custom hook to provide error handling capabilities to forms
 * @param form Form object from react-hook-form
 */
export const useFormErrorHandler = (form: any) => {
  const logFormErrors = () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Form errors:', form.formState.errors);
    }
  };
  
  const showFormErrors = () => {
    // Get all error messages
    const errors = form.formState.errors;
    const errorMessages: string[] = [];
    
    // Extract error messages from the form state
    Object.keys(errors).forEach(field => {
      if (errors[field]?.message) {
        errorMessages.push(errors[field].message);
      }
    });
    
    // Show toast with the first error message
    if (errorMessages.length > 0) {
      showErrorToast(errorMessages[0], 'Form Error');
    }
    
    logFormErrors();
  };
  
  return {
    logFormErrors,
    showFormErrors,
  };
};

/**
 * Determine if an error is a session expiration error
 * @param error Error to check
 * @returns Boolean indicating if the error is due to session expiration
 */
export const isSessionExpiredError = (error: unknown): boolean => {
  // Check if this is an Axios error with a 401 response
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as any).response;
    
    if (response && typeof response === 'object') {
      // Check for 401 status code
      if (response.status === 401) {
        // Check for specific error codes or messages related to token expiration
        if (response.data && typeof response.data === 'object') {
          const apiError = response.data as ApiErrorResponse;
          
          if (apiError.errorCode === 'TOKEN_EXPIRED' || 
              apiError.message.includes('expired') || 
              apiError.message.includes('token')) {
            return true;
          }
        }
        
        // If no specific error code/message, consider any 401 as a session expiration
        return true;
      }
    }
  }
  
  return false;
};

/**
 * Determine if an error is a CSRF token error
 * @param error Error to check
 * @returns Boolean indicating if the error is due to CSRF token issues
 */
export const isCsrfError = (error: unknown): boolean => {
  // Check if this is an Axios error with a 403 response
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as any).response;
    
    if (response && typeof response === 'object' && response.status === 403) {
      // Check for specific error messages related to CSRF
      if (response.data && typeof response.data === 'object') {
        const apiError = response.data as ApiErrorResponse;
        
        if (apiError.message.includes('CSRF') || 
            apiError.errorCode === 'CSRF_ERROR') {
          return true;
        }
      }
    }
  }
  
  return false;
};