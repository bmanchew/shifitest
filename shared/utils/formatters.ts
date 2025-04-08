/**
 * Formats category codes into human-readable text
 * @param category The category code to format
 * @returns Formatted category text
 */
export function formatCategoryText(category: string): string {
  switch (category) {
    case "accounting": return "Accounting & Billing";
    case "customer_issue": return "Customer Issue";
    case "technical_issue": return "Technical Issue";
    case "other": return "Other";
    default: return category;
  }
}

/**
 * Formats status codes into human-readable text
 * @param status The status code to format
 * @returns Formatted status text
 */
export function getStatusText(status: string): string {
  switch (status) {
    case "open": return "Open";
    case "in_progress": return "In Progress";
    case "pending": return "Pending";
    case "resolved": return "Resolved";
    case "closed": return "Closed";
    default: return status;
  }
}

/**
 * Formats priority codes into human-readable text
 * @param priority The priority code to format
 * @returns Formatted priority text
 */
export function getPriorityText(priority: string): string {
  switch (priority) {
    case "low": return "Low";
    case "normal": return "Normal";
    case "high": return "High";
    case "urgent": return "Urgent";
    default: return priority;
  }
}

/**
 * Returns the appropriate color for a ticket status
 * @param status The status code
 * @returns CSS color class name
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case "open": return "bg-blue-100 text-blue-800";
    case "in_progress": return "bg-yellow-100 text-yellow-800";
    case "pending": return "bg-purple-100 text-purple-800";
    case "resolved": return "bg-green-100 text-green-800";
    case "closed": return "bg-gray-100 text-gray-800";
    default: return "bg-gray-100 text-gray-800";
  }
}

/**
 * Returns the appropriate color for a ticket priority
 * @param priority The priority code
 * @returns CSS color class name
 */
export function getPriorityColor(priority: string): string {
  switch (priority) {
    case "low": return "bg-blue-100 text-blue-800";
    case "normal": return "bg-green-100 text-green-800";
    case "high": return "bg-orange-100 text-orange-800";
    case "urgent": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-800";
  }
}

/**
 * Formats a date into a human-readable string
 * @param date The date to format
 * @returns Formatted date string
 */
export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Formats a verification status to human-readable text
 * @param status The verification status to format
 * @returns Formatted verification status text
 */
export function formatVerificationStatus(status: string): string {
  switch (status) {
    case "pending": return "Pending";
    case "in_progress": return "In Progress";
    case "complete": return "Complete";
    case "failed": return "Failed";
    case "rejected": return "Rejected";
    default: return status;
  }
}

/**
 * Returns appropriate color for a verification status
 * @param status The verification status
 * @returns CSS color class name
 */
export function getVerificationStatusColor(status: string): string {
  switch (status) {
    case "pending": return "bg-yellow-100 text-yellow-800";
    case "in_progress": return "bg-blue-100 text-blue-800";
    case "complete": return "bg-green-100 text-green-800";
    case "failed": return "bg-red-100 text-red-800";
    case "rejected": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-800";
  }
}