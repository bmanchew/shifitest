
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

// Get the API URL from environment variables, defaulting to relative path if not available
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

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
  // If it's already an absolute URL or API_BASE_URL is not set, return it as is
  if (url.startsWith('http') || !API_BASE_URL) {
    return url;
  }
  
  // If it's an API call that doesn't already include /api, add the API base URL
  if (url.startsWith('/api/')) {
    // Replace /api/ with the full API base URL
    return `${API_BASE_URL}${url.substring(4)}`;
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
  
  const res = await fetch(fullUrl, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
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
