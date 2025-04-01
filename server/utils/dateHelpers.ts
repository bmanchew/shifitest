/**
 * Date Helper Utilities
 * 
 * This module provides utility functions for handling dates consistently throughout the application.
 * It handles common date operations like safely parsing date values and sorting objects by date properties,
 * with proper handling of null/undefined dates.
 */

/**
 * Converts a potential date string/object or null/undefined to a Date object safely
 * 
 * @param dateValue - A date string, Date object, or null/undefined value to convert
 * @returns A valid Date object. For null/undefined values, returns Unix epoch (Jan 1, 1970)
 * 
 * @example
 * // Convert a string date
 * const date1 = safeDate('2023-05-15');
 * 
 * // Handle a null value
 * const date2 = safeDate(null); // Returns Jan 1, 1970
 * 
 * // Convert an existing Date object
 * const date3 = safeDate(new Date()); 
 */
export function safeDate(dateValue: string | Date | null | undefined): Date {
  if (!dateValue) {
    return new Date(0); // Use Unix epoch start for null/undefined dates
  }
  
  return new Date(dateValue);
}

/**
 * Sort function for sorting array of objects by date property (descending, newest first)
 * 
 * This function accepts two objects and compares their date properties to produce a sort value.
 * It safely handles null/undefined dates by using the safeDate utility.
 * 
 * @param a - First object to compare
 * @param b - Second object to compare
 * @param dateProperty - Property name that contains the date (default: 'createdAt')
 * @returns Comparison value for sorting: negative if b is newer, positive if a is newer
 * 
 * @example
 * // Sort an array of objects by createdAt date, newest first
 * const sortedItems = items.sort(sortByDateDesc);
 * 
 * // Sort by a custom date property
 * const sortedByUpdated = items.sort((a, b) => sortByDateDesc(a, b, 'updatedAt'));
 */
export function sortByDateDesc(a: any, b: any, dateProperty = 'createdAt'): number {
  // Handle null or undefined inputs
  if (!a || !b) {
    return 0;
  }
  
  // Use optional chaining to handle missing properties
  const dateA = safeDate(a?.[dateProperty]);
  const dateB = safeDate(b?.[dateProperty]);
  return dateB.getTime() - dateA.getTime();
}

/**
 * Sort function for sorting array of objects by date property (ascending, oldest first)
 * 
 * This function accepts two objects and compares their date properties to produce a sort value.
 * It safely handles null/undefined dates by using the safeDate utility.
 * 
 * @param a - First object to compare
 * @param b - Second object to compare
 * @param dateProperty - Property name that contains the date (default: 'createdAt')
 * @returns Comparison value for sorting: negative if a is older, positive if b is older
 * 
 * @example
 * // Sort an array of objects by createdAt date, oldest first
 * const sortedItems = items.sort(sortByDateAsc);
 * 
 * // Sort by a custom date property
 * const sortedByUpdated = items.sort((a, b) => sortByDateAsc(a, b, 'updatedAt'));
 */
export function sortByDateAsc(a: any, b: any, dateProperty = 'createdAt'): number {
  // Handle null or undefined inputs
  if (!a || !b) {
    return 0;
  }
  
  // Use optional chaining to handle missing properties
  const dateA = safeDate(a?.[dateProperty]);
  const dateB = safeDate(b?.[dateProperty]); 
  return dateA.getTime() - dateB.getTime();
}

/**
 * Generate a random ID string
 * @param length Length of the random string to generate (default: 12)
 * @returns Random ID string
 */
export function generateId(length: number = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}