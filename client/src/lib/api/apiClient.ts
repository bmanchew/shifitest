import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

// Define our API response type
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
}

// Create a configured axios instance
const axiosInstance = axios.create({
  baseURL: '/',
  withCredentials: true, // This ensures cookies are sent with requests
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Add interceptor to handle CSRF tokens
axiosInstance.interceptors.request.use(async (config) => {
  // For GET requests, we don't need to fetch a CSRF token
  if (config.method?.toLowerCase() === 'get') {
    return config;
  }

  // For non-GET requests, we need to fetch a CSRF token first
  try {
    // Fetch the CSRF token
    const csrfResponse = await axios.get('/api/csrf-token', {
      withCredentials: true, // Ensure cookies are sent
    });

    // Add the CSRF token to the request headers
    if (csrfResponse.data && csrfResponse.data.csrfToken) {
      config.headers['X-CSRF-Token'] = csrfResponse.data.csrfToken;
    }
  } catch (error) {
    console.error('Failed to fetch CSRF token:', error);
    // Continue with the request even if we couldn't get a CSRF token
    // The server will reject the request if a CSRF token is required
  }

  return config;
});

// Function to handle API response formatting
function formatResponse<T>(response: AxiosResponse<T>): ApiResponse<T> {
  return {
    data: response.data,
    error: null,
    status: response.status,
  };
}

// Function to handle API errors
function formatError(error: AxiosError): ApiResponse<any> {
  // Default error message
  let errorMessage = 'An unexpected error occurred';

  // If we have a response from the server
  if (error.response) {
    const status = error.response.status;

    // If the server sent an error message
    if (error.response.data && typeof error.response.data === 'object') {
      const data = error.response.data as Record<string, any>;
      if (data.message) {
        errorMessage = data.message;
      } else if (data.error) {
        errorMessage = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
      }
    }

    // Special handling for common error codes
    if (status === 401) {
      errorMessage = 'Authentication required. Please log in.';
    } else if (status === 403) {
      errorMessage = 'You do not have permission to perform this action.';
    } else if (status === 404) {
      errorMessage = 'Resource not found.';
    } else if (status === 422) {
      errorMessage = 'Invalid data provided.';
    } else if (status >= 500) {
      errorMessage = 'Server error. Please try again later.';
    }

    return {
      data: null,
      error: errorMessage,
      status,
    };
  }

  // If the request was made but no response was received
  if (error.request) {
    return {
      data: null,
      error: 'No response received from server. Please check your network connection.',
      status: 0,
    };
  }

  // Something else happened while setting up the request
  return {
    data: null,
    error: errorMessage,
    status: 0,
  };
}

// API client with typed methods
export const apiClient = {
  // GET request
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await axiosInstance.get<T>(url, config);
      return formatResponse<T>(response);
    } catch (error) {
      return formatError(error as AxiosError);
    }
  },

  // POST request
  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await axiosInstance.post<T>(url, data, config);
      return formatResponse<T>(response);
    } catch (error) {
      return formatError(error as AxiosError);
    }
  },

  // PUT request
  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await axiosInstance.put<T>(url, data, config);
      return formatResponse<T>(response);
    } catch (error) {
      return formatError(error as AxiosError);
    }
  },

  // PATCH request
  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await axiosInstance.patch<T>(url, data, config);
      return formatResponse<T>(response);
    } catch (error) {
      return formatError(error as AxiosError);
    }
  },

  // DELETE request
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await axiosInstance.delete<T>(url, config);
      return formatResponse<T>(response);
    } catch (error) {
      return formatError(error as AxiosError);
    }
  },
};