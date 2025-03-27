/**
 * Helper functions for date handling
 */

/**
 * Convert a potential date string/object or null/undefined to a Date object safely
 * @param dateValue - A date string, Date object, or null/undefined
 * @returns A valid Date object
 */
export function safeDate(dateValue: string | Date | null | undefined): Date {
  if (!dateValue) {
    return new Date(0); // Use Unix epoch start for null/undefined dates
  }
  
  return new Date(dateValue);
}

/**
 * Sort function for sorting array of objects by date property (descending, newest first)
 * @param a - First object
 * @param b - Second object
 * @param dateProperty - Property name that contains the date (default: 'createdAt')
 * @returns Comparison value for sorting (-1, 0, 1)
 */
export function sortByDateDesc(a: any, b: any, dateProperty = 'createdAt'): number {
  const dateA = safeDate(a[dateProperty]);
  const dateB = safeDate(b[dateProperty]);
  return dateB.getTime() - dateA.getTime();
}

/**
 * Sort function for sorting array of objects by date property (ascending, oldest first)
 * @param a - First object
 * @param b - Second object
 * @param dateProperty - Property name that contains the date (default: 'createdAt')
 * @returns Comparison value for sorting (-1, 0, 1)
 */
export function sortByDateAsc(a: any, b: any, dateProperty = 'createdAt'): number {
  const dateA = safeDate(a[dateProperty]);
  const dateB = safeDate(b[dateProperty]); 
  return dateA.getTime() - dateB.getTime();
}