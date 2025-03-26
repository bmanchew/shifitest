import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
  });
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
}

export function generateTicketNumber(): string {
  const randomPart = Math.floor(10000 + Math.random() * 90000);
  return `TICKET-${randomPart}`;
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function(...args: Parameters<T>): void {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(later, wait);
  };
}

export function getInitials(name: string): string {
  if (!name) return "";
  return name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()
    .substring(0, 2);
}

export function classNames(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function calculateDaysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds
  const diffDays = Math.round(Math.abs((date1.getTime() - date2.getTime()) / oneDay));
  return diffDays;
}

export function isValidEmail(email: string): boolean {
  const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
}

export function isValidPhone(phone: string): boolean {
  const re = /^\+?[1-9]\d{1,14}$/;
  return re.test(phone);
}

export function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case "active":
      return "bg-green-100 text-green-800";
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "completed":
      return "bg-blue-100 text-blue-800";
    case "declined":
      return "bg-red-100 text-red-800";
    case "cancelled":
      return "bg-gray-100 text-gray-800";
    case "archived":
      return "bg-gray-100 text-gray-800";
    case "new":
      return "bg-blue-100 text-blue-800";
    case "in_progress":
      return "bg-yellow-100 text-yellow-800";
    case "resolved":
      return "bg-green-100 text-green-800";
    case "closed":
      return "bg-gray-100 text-gray-800";
    case "urgent":
      return "bg-red-100 text-red-800";
    case "high":
      return "bg-orange-100 text-orange-800";
    case "normal":
      return "bg-blue-100 text-blue-800";
    case "low":
      return "bg-green-100 text-green-800";
    case "pending_merchant":
      return "bg-orange-100 text-orange-800";
    case "pending_customer":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

/**
 * Rank a string based on how closely it matches a search query
 * Used for fuzzy filtering in table components
 * 
 * @param text - The text to search in
 * @param query - The search query
 * @returns A ranking score (higher is better match)
 */
export function rank(text: string, query: string): number {
  if (!text || !query) return 0;
  
  // Convert both strings to lowercase for case-insensitive comparison
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  
  // Exact match gets highest rank
  if (textLower === queryLower) return 100;
  
  // Check if the text starts with the query
  if (textLower.startsWith(queryLower)) return 75;
  
  // Check if the text contains the query
  if (textLower.includes(queryLower)) {
    // Higher rank for words that contain the query at the beginning of a word
    const words = textLower.split(/\s+/);
    for (const word of words) {
      if (word.startsWith(queryLower)) return 60;
    }
    return 50;
  }
  
  // Check for partial word matches (useful for longer queries)
  if (queryLower.length > 3) {
    const queryParts = queryLower.split(/\s+/);
    let matches = 0;
    for (const part of queryParts) {
      if (part.length > 2 && textLower.includes(part)) {
        matches++;
      }
    }
    if (matches > 0) {
      return 20 + (matches * 10);
    }
  }
  
  return 0;
}