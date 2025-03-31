# Utility Functions Documentation

This document provides comprehensive documentation for the utility functions and helper modules used throughout the application.

## Client-Side Utilities

### `client/src/lib/utils.ts`

#### `cn(...inputs: ClassValue[]): string`

A utility function for conditionally joining CSS class names together.

**Parameters:**
- `inputs`: Any number of class name values (strings, objects, or arrays)

**Returns:**
- A string containing all the class names joined together

**Example:**
```typescript
import { cn } from "@/lib/utils";

// Simple classes
const className = cn("base-class", isActive && "active");

// With tailwind-merge functionality
const mergedClasses = cn("px-2 py-1", isSmall ? "text-sm" : "text-base");
```

#### `formatCurrency(value: number, options?: FormatCurrencyOptions): string`

Formats a number as a currency string.

**Parameters:**
- `value`: The number to format
- `options`: Optional configuration object with properties:
  - `currency`: The currency code (default: "USD")
  - `locale`: The locale to use (default: "en-US")
  - `decimals`: Number of decimal places (default: 2)

**Returns:**
- Formatted currency string

**Example:**
```typescript
import { formatCurrency } from "@/lib/utils";

// Basic usage
formatCurrency(1234.56); // "$1,234.56"

// With options
formatCurrency(1234.56, { currency: "EUR", decimals: 0 }); // "€1,235"
```

#### `formatDate(date: Date | string | number, format?: string): string`

Formats a date into a readable string.

**Parameters:**
- `date`: The date to format (Date object, ISO string, or timestamp)
- `format`: Optional format string (default: "MMM dd, yyyy")

**Returns:**
- Formatted date string

**Example:**
```typescript
import { formatDate } from "@/lib/utils";

// Basic usage
formatDate(new Date(2023, 0, 1)); // "Jan 01, 2023"

// With custom format
formatDate(new Date(2023, 0, 1), "yyyy-MM-dd"); // "2023-01-01"
```

#### `getErrorMessage(error: unknown): string`

Extracts a human-readable error message from various error types.

**Parameters:**
- `error`: Any error object

**Returns:**
- Human-readable error message

**Example:**
```typescript
import { getErrorMessage } from "@/lib/utils";

try {
  // Some operation
} catch (error) {
  const message = getErrorMessage(error);
  // Display message to user
}
```

### `client/src/lib/csrf.ts`

#### `getCsrfToken(): Promise<string>`

Retrieves a CSRF token from the server for use in API requests.

**Returns:**
- Promise resolving to a CSRF token string

**Example:**
```typescript
import { getCsrfToken } from "@/lib/csrf";

async function submitForm() {
  const token = await getCsrfToken();
  // Include token in request headers
}
```

#### `isCsrfTokenExpired(): boolean`

Checks if the current CSRF token has expired and needs to be refreshed.

**Returns:**
- `true` if the token has expired, `false` otherwise

### `client/src/lib/api.ts`

#### `apiRequest<T>(endpoint: string, options?: ApiRequestOptions): Promise<T>`

Makes an authenticated request to the API with CSRF protection.

**Parameters:**
- `endpoint`: API endpoint path
- `options`: Request options including:
  - `method`: HTTP method (default: "GET")
  - `data`: Request payload
  - `headers`: Additional headers
  - `withCredentials`: Whether to include credentials (default: true)

**Returns:**
- Promise resolving to the response data

**Example:**
```typescript
import { apiRequest } from "@/lib/api";

// GET request
const data = await apiRequest("/api/users/me");

// POST request
const result = await apiRequest("/api/items", {
  method: "POST",
  data: { name: "New Item" }
});
```

#### `handleApiError(error: unknown): ApiError`

Processes API errors and returns a standardized error object.

**Parameters:**
- `error`: Error from API request

**Returns:**
- Standardized ApiError object

### `client/src/lib/queryClient.ts`

#### `queryClient`

The main React Query client instance used throughout the application.

**Properties:**
- Default query options
- Error handling configuration
- Cache configuration

**Example:**
```typescript
import { queryClient } from "@/lib/queryClient";

// Invalidate queries
queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
```

## Server-Side Utilities

### `server/utils/dateHelpers.ts`

#### `formatDate(date: Date, format?: string): string`

Formats a date into a readable string.

**Parameters:**
- `date`: The date to format
- `format`: Optional format string (default: "yyyy-MM-dd")

**Returns:**
- Formatted date string

#### `addDays(date: Date, days: number): Date`

Adds a specified number of days to a date.

**Parameters:**
- `date`: The starting date
- `days`: Number of days to add

**Returns:**
- New Date object with days added

#### `subtractDays(date: Date, days: number): Date`

Subtracts a specified number of days from a date.

**Parameters:**
- `date`: The starting date
- `days`: Number of days to subtract

**Returns:**
- New Date object with days subtracted

#### `isWithinRange(date: Date, startDate: Date, endDate: Date): boolean`

Checks if a date falls within a specified range.

**Parameters:**
- `date`: The date to check
- `startDate`: The start of the range
- `endDate`: The end of the range

**Returns:**
- `true` if the date is within the range, `false` otherwise

#### `getDateRangeForPeriod(period: 'day' | 'week' | 'month' | 'year'): { startDate: Date, endDate: Date }`

Gets a date range object for a specified time period.

**Parameters:**
- `period`: The time period ('day', 'week', 'month', or 'year')

**Returns:**
- Object with startDate and endDate properties

### `server/utils/contractHelpers.ts`

#### `calculateMonthlyPayment(principal: number, annualInterestRate: number, termMonths: number): number`

Calculates the monthly payment for a loan.

**Parameters:**
- `principal`: The loan amount
- `annualInterestRate`: Annual interest rate (as a decimal, e.g., 0.05 for 5%)
- `termMonths`: Loan term in months

**Returns:**
- Monthly payment amount

#### `calculateTotalPayment(monthlyPayment: number, termMonths: number): number`

Calculates the total payment over the life of a loan.

**Parameters:**
- `monthlyPayment`: Monthly payment amount
- `termMonths`: Loan term in months

**Returns:**
- Total payment amount

#### `calculateTotalInterest(principal: number, totalPayment: number): number`

Calculates the total interest paid over the life of a loan.

**Parameters:**
- `principal`: The loan amount
- `totalPayment`: Total payment amount

**Returns:**
- Total interest amount

#### `generateContractNumber(): string`

Generates a unique contract number.

**Returns:**
- Contract number string

#### `validateContractData(data: ContractData): boolean`

Validates contract data for completeness and correctness.

**Parameters:**
- `data`: Contract data to validate

**Returns:**
- `true` if valid, `false` otherwise

### `server/utils/asyncDb.ts`

#### `withTransaction<T>(db: PostgresJsDatabase, callback: (tx: PostgresJsDatabase) => Promise<T>): Promise<T>`

Executes database operations within a transaction.

**Parameters:**
- `db`: Database instance
- `callback`: Function containing operations to execute in the transaction

**Returns:**
- Promise resolving to the result of the callback

**Example:**
```typescript
import { withTransaction } from "../utils/asyncDb";

async function createUserWithProfile(userData, profileData) {
  return withTransaction(db, async (tx) => {
    const user = await tx.insert(users).values(userData).returning();
    const profile = await tx.insert(profiles).values({
      ...profileData,
      userId: user[0].id
    }).returning();
    return { user: user[0], profile: profile[0] };
  });
}
```

#### `executeQuery<T>(query: Promise<T>, errorMessage: string): Promise<T>`

Executes a database query with standardized error handling.

**Parameters:**
- `query`: The query to execute
- `errorMessage`: Error message prefix to use if the query fails

**Returns:**
- Promise resolving to the query result

## Email Service Utilities

### `server/services/email.ts`

#### `EmailService.sendEmail(options: SendEmailOptions): Promise<boolean>`

Sends an email through the configured email provider.

**Parameters:**
- `options`: Email options including:
  - `to`: Recipient email
  - `subject`: Email subject
  - `template`: Template name or HTML content
  - `data`: Template data
  - `attachments`: Optional file attachments

**Returns:**
- Promise resolving to boolean indicating success

#### `EmailService.sendPasswordResetEmail(email: string, token: string): Promise<boolean>`

Sends a password reset email to a user.

**Parameters:**
- `email`: Recipient email
- `token`: Password reset token

**Returns:**
- Promise resolving to boolean indicating success

#### `EmailService.sendMagicLinkEmail(email: string, token: string): Promise<boolean>`

Sends a magic link email for passwordless authentication.

**Parameters:**
- `email`: Recipient email
- `token`: Magic link token

**Returns:**
- Promise resolving to boolean indicating success

#### `EmailService.getAppBaseUrl(): string`

Gets the base URL for the application based on the current environment.

**Returns:**
- Application base URL string

## Notification Utilities

### `server/services/notifications.ts`

#### `NotificationService.createNotification(data: NotificationData): Promise<Notification>`

Creates a new notification for a user.

**Parameters:**
- `data`: Notification data including:
  - `userId`: User ID
  - `userType`: User type (admin, merchant, customer)
  - `type`: Notification type
  - `title`: Notification title
  - `message`: Notification message
  - `metadata`: Optional additional data

**Returns:**
- Promise resolving to the created notification

#### `NotificationService.markAsRead(notificationId: number): Promise<boolean>`

Marks a notification as read.

**Parameters:**
- `notificationId`: ID of the notification to mark

**Returns:**
- Promise resolving to boolean indicating success

#### `NotificationService.getUnreadCount(userId: number, userType: UserType): Promise<number>`

Gets the count of unread notifications for a user.

**Parameters:**
- `userId`: User ID
- `userType`: User type (admin, merchant, customer)

**Returns:**
- Promise resolving to the count of unread notifications

## Logging Utilities

### `server/utils/logger.ts`

#### `logger.info(message: string, meta?: LogMeta): void`

Logs an informational message.

**Parameters:**
- `message`: The log message
- `meta`: Optional metadata to include with the log

#### `logger.error(message: string, error?: Error, meta?: LogMeta): void`

Logs an error message.

**Parameters:**
- `message`: The error message
- `error`: Optional Error object
- `meta`: Optional metadata to include with the log

#### `logger.warn(message: string, meta?: LogMeta): void`

Logs a warning message.

**Parameters:**
- `message`: The warning message
- `meta`: Optional metadata to include with the log

#### `logger.debug(message: string, meta?: LogMeta): void`

Logs a debug message (only in development).

**Parameters:**
- `message`: The debug message
- `meta`: Optional metadata to include with the log

## Security Utilities

### `server/utils/security.ts`

#### `hashPassword(password: string): Promise<string>`

Hashes a password using bcrypt.

**Parameters:**
- `password`: The password to hash

**Returns:**
- Promise resolving to the hashed password

#### `verifyPassword(password: string, hashedPassword: string): Promise<boolean>`

Verifies a password against its hash.

**Parameters:**
- `password`: The password to verify
- `hashedPassword`: The stored hash

**Returns:**
- Promise resolving to boolean indicating if the password is correct

#### `generateToken(length: number = 32): string`

Generates a secure random token.

**Parameters:**
- `length`: Token length in bytes (default: 32)

**Returns:**
- Random token string

#### `sanitizeInput(input: string): string`

Sanitizes user input to prevent injection attacks.

**Parameters:**
- `input`: The string to sanitize

**Returns:**
- Sanitized string