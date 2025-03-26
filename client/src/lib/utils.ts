import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Returns a color variant for the status based on its value
 * @param status The status string
 * @returns The appropriate color variant
 */
export function getStatusColor(status: string): "default" | "destructive" | "secondary" | "outline" | "success" | "warning" | "info" {
  switch (status) {
    case "active":
    case "resolved":
    case "completed":
    case "tokenized":
    case "success":
      return "success";
    case "pending":
    case "in_progress":
    case "processing":
      return "secondary";
    case "declined":
    case "cancelled":
    case "failed":
    case "closed":
      return "destructive";
    case "pending_merchant":
    case "pending_customer":
    case "new":
      return "warning";
    case "archived":
      return "outline";
    default:
      return "default";
  }
}

/**
 * Format currency amount with proper currency symbol
 * @param amount The amount to format
 * @param currency The currency code (default: USD)
 * @returns Formatted currency string
 */
export const formatCurrency = (amount: number, currency = "USD") => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
};

/**
 * Format date for display
 * @param date The date to format
 * @param options Intl.DateTimeFormatOptions
 * @returns Formatted date string
 */
export const formatDate = (
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  }
) => {
  if (!date) return "N/A";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", options).format(d);
};

/**
 * Calculate days remaining (positive) or overdue (negative)
 * @param dueDate The due date
 * @returns Number of days remaining or overdue
 */
export const calculateDaysRemaining = (dueDate: Date | string) => {
  const due = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  
  const diffTime = due.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Truncate text with ellipsis after a certain length
 * @param text The text to truncate
 * @param maxLength Maximum length before truncation
 * @returns Truncated text with ellipsis if needed
 */
export const truncateText = (text: string, maxLength: number) => {
  if (!text) return "";
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
};

/**
 * Calculate progress percentage from current and total values
 * @param current Current value
 * @param total Total value
 * @returns Progress percentage (0-100)
 */
export const calculateProgress = (current: number, total: number) => {
  if (total === 0 || current < 0) return 0;
  if (current > total) return 100;
  return Math.round((current / total) * 100);
};

/**
 * Format date and time for display
 * @param date The date to format
 * @returns Formatted date and time string
 */
export const formatDateTime = (date: Date | string) => {
  if (!date) return "N/A";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
};

/**
 * Format a date as a relative time (e.g., "5 minutes ago")
 * @param date Date to format
 * @returns Formatted relative time string
 */
export const formatRelativeTime = (date: Date | string) => {
  if (!date) return "N/A";
  
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return `${diffInSeconds} second${diffInSeconds !== 1 ? 's' : ''} ago`;
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) {
    return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;
  }
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths} month${diffInMonths !== 1 ? 's' : ''} ago`;
  }
  
  const diffInYears = Math.floor(diffInMonths / 12);
  return `${diffInYears} year${diffInYears !== 1 ? 's' : ''} ago`;
};

/**
 * Generate a random ID
 * @param length Length of the ID
 * @returns Random ID string
 */
export const generateId = (length = 8) => {
  return Math.random().toString(36).substring(2, 2 + length);
};

/**
 * Extract initials from a name (first letter of first and last name)
 * @param name Full name to extract initials from
 * @returns Initials (1-2 characters)
 */
export const getInitials = (name: string) => {
  if (!name) return "?";
  
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) return "?";
  
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

/**
 * Create a rank function for data-table sorting
 * @param items Array of items to rank
 * @param getRankValue Function to get the value to rank by
 * @returns Object with rank values for each item
 */
export function rank<T>(
  items: T[],
  getRankValue: (item: T) => any
): Record<string, number> {
  // Create a map for O(1) lookups
  const ranks: Record<string, number> = {};
  
  // Sort items by rank value
  const sortedItems = [...items].sort((a, b) => {
    const valueA = getRankValue(a);
    const valueB = getRankValue(b);
    
    // Handle undefined/null values
    if (valueA == null && valueB == null) return 0;
    if (valueA == null) return 1;
    if (valueB == null) return -1;
    
    // Compare based on type
    if (typeof valueA === 'number' && typeof valueB === 'number') {
      return valueB - valueA;
    }
    
    if (typeof valueA === 'string' && typeof valueB === 'string') {
      return valueA.localeCompare(valueB);
    }
    
    if (valueA instanceof Date && valueB instanceof Date) {
      return valueB.getTime() - valueA.getTime();
    }
    
    // Fallback
    return String(valueA).localeCompare(String(valueB));
  });
  
  // Assign ranks (1-based)
  sortedItems.forEach((item, index) => {
    // Use a stable identifier, assuming items have unique IDs
    // If not, use the stringified item as a fallback
    const id = (item as any).id || JSON.stringify(item);
    ranks[id] = index + 1;
  });
  
  return ranks;
}