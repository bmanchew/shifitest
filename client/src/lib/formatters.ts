/**
 * Utility functions for formatting data
 */

/**
 * Format a phone number into a standardized format
 * Converts any string of digits into (XXX) XXX-XXXX format
 * 
 * @param phoneNumber Phone number to format
 * @returns Formatted phone number
 */
export function formatPhoneNumber(phoneNumber: string): string {
  // Strip all non-digit characters
  const digits = phoneNumber.replace(/\D/g, '');
  
  // Handle different lengths
  if (digits.length < 4) {
    return digits;
  } 
  
  if (digits.length < 7) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }
  
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  
  // Handle 11-digit numbers with country code (e.g., 1XXXXXXXXXX)
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  
  // For any other length, try to format as best as possible
  if (digits.length > 10) {
    // Try to extract the last 10 digits
    const last10 = digits.slice(-10);
    return `(${last10.slice(0, 3)}) ${last10.slice(3, 6)}-${last10.slice(6)}`;
  }
  
  // Default format for other lengths
  return digits;
}

/**
 * Format a currency amount
 * 
 * @param amount Number to format as currency
 * @param currency Currency code (default: USD)
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Format a date to a human-readable string
 * 
 * @param date Date to format
 * @param includeTime Whether to include the time
 * @returns Formatted date string
 */
export function formatDate(date: Date | string, includeTime: boolean = false): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const options: Intl.DateTimeFormatOptions = { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric'
  };
  
  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }
  
  return new Intl.DateTimeFormat('en-US', options).format(dateObj);
}

/**
 * Format a percentage value
 * 
 * @param value Value to format as percentage
 * @param decimalPlaces Number of decimal places to include
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number, decimalPlaces: number = 2): string {
  return `${value.toFixed(decimalPlaces)}%`;
}