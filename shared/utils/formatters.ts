/**
 * Utility functions for formatting and styling based on data
 */

/**
 * Format a verification status to a user-friendly display string
 * @param status Verification status string
 * @returns Formatted status string 
 */
export function formatVerificationStatus(status: string): string {
  switch (status) {
    case 'verified':
      return 'Verified';
    case 'pending':
      return 'Pending';
    case 'rejected':
      return 'Failed';
    case 'not_started':
      return 'Not Started';
    case 'under_review':
      return 'Under Review';
    case 'incomplete':
      return 'Incomplete';
    default:
      return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
  }
}

/**
 * Get the CSS class for a verification status badge
 * @param status Verification status string
 * @returns CSS class string
 */
export function getVerificationStatusColor(status: string): string {
  switch (status) {
    case 'verified':
      return 'bg-green-50 text-green-800 border-green-200';
    case 'pending':
      return 'bg-blue-50 text-blue-800 border-blue-200';
    case 'rejected':
      return 'bg-red-50 text-red-800 border-red-200';
    case 'not_started':
      return 'bg-gray-50 text-gray-800 border-gray-200';
    case 'under_review':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'incomplete':
      return 'bg-orange-50 text-orange-800 border-orange-200';
    default:
      return 'bg-gray-50 text-gray-800 border-gray-200';
  }
}

/**
 * Format currency amount with dollar sign and 2 decimal places
 * @param amount Number to format as currency
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a date to a standardized display format
 * @param date Date to format
 * @returns Formatted date string
 */
export function formatDate(date: Date | string | number): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

/**
 * Format a phone number with proper US formatting
 * @param phoneNumber Phone number to format
 * @returns Formatted phone number string
 */
export function formatPhoneNumber(phoneNumber: string): string {
  // Clean input of any non-digit characters
  const cleaned = phoneNumber.replace(/\D/g, '');

  // Check if the input is a valid phone number
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);

  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }

  return phoneNumber;
}

/**
 * Format a percentage with % symbol
 * @param value Number to format as percentage
 * @param decimals Number of decimal places (default: 2)
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format a file size in bytes to a human-readable format
 * @param bytes File size in bytes
 * @returns Formatted file size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format a name for display (capitalization, etc.)
 * @param name Name to format
 * @returns Formatted name string
 */
export function formatName(name: string): string {
  if (!name) return '';
  
  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Truncate text to a specific length with ellipsis
 * @param text Text to truncate
 * @param maxLength Maximum length before truncation
 * @returns Truncated text string
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}