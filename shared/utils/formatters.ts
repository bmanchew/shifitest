/**
 * Shared formatting utility functions
 * This file contains reusable formatting functions that can be used by both frontend and backend
 */

/**
 * Format currency amount in USD
 * @param amount Amount to format
 * @param options Intl.NumberFormat options
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, options: Intl.NumberFormatOptions = {}): string {
  const defaultOptions: Intl.NumberFormatOptions = {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options
  };
  
  return new Intl.NumberFormat('en-US', defaultOptions).format(amount);
}

/**
 * Format a date with standardized options
 * @param date Date to format
 * @param includeTime Whether to include the time component
 * @returns Formatted date string
 */
export function formatDate(date: Date | string | number | null | undefined, includeTime = false): string {
  if (!date) return 'N/A';
  
  const dateObj = date instanceof Date ? date : new Date(date);
  
  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date';
  }
  
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {})
  };
  
  return new Intl.DateTimeFormat('en-US', options).format(dateObj);
}

/**
 * Format a percentage value
 * @param value Decimal value to format as percentage
 * @param fractionDigits Number of decimal places to show
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number, fractionDigits = 2): string {
  return `${(value * 100).toFixed(fractionDigits)}%`;
}

/**
 * Format a phone number to human-readable format
 * @param phone Phone number to format
 * @returns Formatted phone number string
 */
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return 'N/A';
  
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Check if we have a 10-digit US number
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  } else if (cleaned.length === 11 && cleaned[0] === '1') {
    // Handle US numbers with country code
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  
  // For international or other formats, just add proper spacing
  return phone;
}

/**
 * Format file size in human-readable form
 * @param bytes Size in bytes
 * @param decimals Number of decimal places
 * @returns Formatted file size string
 */
export function formatFileSize(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/**
 * Convert camelCase to Title Case
 * @param str String in camelCase
 * @returns Title Case string
 */
export function camelToTitleCase(str: string): string {
  // Add space before uppercase letters and capitalize the first letter
  const result = str
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase());
  
  return result;
}

/**
 * Truncate a string with ellipsis if it exceeds the max length
 * @param str String to truncate
 * @param maxLength Maximum length before truncation
 * @returns Truncated string
 */
export function truncateString(str: string, maxLength: number): string {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  
  return `${str.substring(0, maxLength)}...`;
}

/**
 * Format a name to always have the first letter capitalized
 * @param name Name to format
 * @returns Formatted name
 */
export function formatName(name: string | null | undefined): string {
  if (!name) return 'N/A';
  
  // Handle multiple words by capitalizing each word
  return name
    .split(' ')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Format account number to show only last digits
 * @param accountNumber Full account number
 * @param visibleDigits Number of digits to show
 * @returns Masked account number
 */
export function maskAccountNumber(accountNumber: string, visibleDigits = 4): string {
  if (!accountNumber) return 'N/A';
  
  const cleaned = accountNumber.replace(/\s+/g, '');
  if (cleaned.length <= visibleDigits) return cleaned;
  
  const mask = '•'.repeat(cleaned.length - visibleDigits);
  return `${mask}${cleaned.slice(-visibleDigits)}`;
}

/**
 * Format a number with thousands separators
 * @param value Number to format
 * @param fractionDigits Number of decimal places
 * @returns Formatted number string
 */
export function formatNumber(value: number, fractionDigits = 0): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(value);
}