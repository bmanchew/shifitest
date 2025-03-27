
// API utility functions for the application

/**
 * Fetch payment schedule data for a customer
 * @param customerId - The ID of the customer
 * @returns Promise with the payment schedule data
 */
export const fetchPaymentSchedule = async (customerId: string) => {
  const response = await fetch(`/api/customers/${customerId}/payment-schedule`);
  if (!response.ok) {
    throw new Error(`Failed to fetch payment schedule: ${response.statusText}`);
  }
  return response.json();
};

/**
 * Update payment schedule for a customer
 * @param customerId - The ID of the customer
 * @param scheduleData - The updated schedule data
 * @returns Promise with the updated payment schedule
 */
export const updatePaymentSchedule = async (customerId: string, scheduleData: any) => {
  const response = await fetch(`/api/customers/${customerId}/payment-schedule`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(scheduleData),
  });
  if (!response.ok) {
    throw new Error(`Failed to update payment schedule: ${response.statusText}`);
  }
  return response.json();
};
import { QueryFunction } from "@tanstack/react-query";
import { API_URL } from '../env';

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    try {
      // First try to parse as JSON (most of our API endpoints return JSON errors)
      const errorData = await res.json();
      const errorMessage =
        errorData.message || errorData.error || JSON.stringify(errorData);
      throw new Error(`${res.status}: ${errorMessage}`);
    } catch (e) {
      // If parsing as JSON fails, fall back to plain text
      const text = (await res.text()) || res.statusText;
      throw new Error(`${res.status}: ${text}`);
    }
  }
}

// Helper to build full URL with API base URL if it's an API endpoint
function buildUrl(url: string): string {
  // If it's already an absolute URL, return it as is
  if (url.startsWith('http')) {
    return url;
  }
  
  // If it's an API call that starts with /api/, replace it with the full API URL
  if (url.startsWith('/api/')) {
    if (API_URL) {
      return `${API_URL}${url.substring(4)}`;
    }
    // Fall back to relative URL if API_URL is not available
    return url;
  }
  
  // For other relative URLs, use them as is (relative to current domain)
  return url;
}

export async function apiRequest<T = Response>(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<T> {
  const fullUrl = buildUrl(url);
  
  // Log API requests in development for debugging
  if (import.meta.env.DEV) {
    console.log(`API Request: ${method} ${fullUrl}`);
  }

  // Get auth token from local storage
  const headers: Record<string, string> = data ? { "Content-Type": "application/json" } : {};
  
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
  
  const res = await fetch(fullUrl, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);

  // If T is Response (the default), just return the response object
  if (method === "HEAD" || method === "DELETE" || res.status === 204) {
    return res as unknown as T;
  }

  // Otherwise, parse as JSON
  return (await res.json()) as T;
}

// Create a query function that uses apiRequest
export const createApiQuery = <T>(
  url: string,
  method: string = "GET",
  data?: unknown
): QueryFunction<T> => {
  return async () => {
    return apiRequest<T>(method, url, data);
  };
};
