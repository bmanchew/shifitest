# Database Documentation

This document provides comprehensive information about the database structure, schema, relationships, and data flows in the ShiFi platform.

## Overview

The ShiFi platform uses PostgreSQL as its primary database. The schema is defined using Drizzle ORM with TypeScript, providing type safety and validation throughout the application.

## Schema Definition

The database schema is defined in `shared/schema.ts`. This file contains:

1. Table definitions
2. Column types and constraints
3. Relationships between tables
4. Insert and select types

## Entity Relationship Diagram

```
+-------------------+         +--------------------+         +--------------------+
|      Users        |         |     Merchants      |         |     Customers      |
+-------------------+         +--------------------+         +--------------------+
| id                |<--+     | id                 |<--+     | id                 |<--+
| email             |   |     | name               |   |     | name               |   |
| password          |   |     | email              |   |     | email              |   |
| firstName         |   |     | phone              |   |     | phone              |   |
| lastName          |   |     | address            |   |     | address            |   |
| role              |   |     | verified           |   |     | city               |   |
| phone             |   |     | userId (FK)        |---+     | state              |   |
| emailVerified     |   |     | ...                |         | zipCode            |   |
| ...               |   |     +--------------------+         | userId (FK)        |---+
+-------------------+   |                                    | ...                |
                        |                                    +--------------------+
                        |
                        |     +--------------------+         +--------------------+
                        |     |     Contracts      |         | Contract Payments  |
                        |     +--------------------+         +--------------------+
                        |     | id                 |<--+     | id                 |
                        |     | contractNumber     |   |     | contractId (FK)    |---+
                        |     | merchantId (FK)    |---+     | amount             |
                        |     | customerId (FK)    |---+     | date               |
                        |     | amount             |   |     | status             |
                        |     | interestRate       |   |     | ...                |
                        |     | termMonths         |   |     +--------------------+
                        |     | status             |   |
                        |     | startDate          |   |     +--------------------+
                        |     | endDate            |   |     | Cancellation Req.  |
                        |     | tokenized          |   |     +--------------------+
                        |     | ...                |   |     | id                 |
                        |     +--------------------+   |     | contractId (FK)    |---+
                                                       |     | merchantId (FK)    |---+
                        +----------------------------+ |     | requestDate        |
                        |                            | |     | reason             |
                        |     +--------------------+ | |     | status             |
                        |     |  Communications    | | |     | reviewedBy (FK)    |---+
                        +---->| id                 | | |     | ...                |
                              | senderId (FK)      |--+ |     +--------------------+
                              | receiverId (FK)    |--+ |
                              | content            |    |     +--------------------+
                              | timestamp          |    |     |   Notifications    |
                              | read               |    |     +--------------------+
                              | ...                |    |     | id                 |
                              +--------------------+    |     | userId (FK)        |---+
                                                        |     | userType           |
                                                        |     | type               |
                                                        |     | title              |
                                                        |     | message            |
                                                        |     | read               |
                                                        |     | ...                |
                                                        |     +--------------------+
                                                        |
                              +--------------------+    |     +--------------------+
                              |  Plaid Connections |    |     |  Blockchain Data   |
                              +--------------------+    |     +--------------------+
                              | id                 |    |     | id                 |
                              | merchantId (FK)    |----+     | contractId (FK)    |---+
                              | itemId             |          | tokenId            |
                              | accessToken        |          | smartContractAddress|
                              | accounts           |          | txHash             |
                              | status             |          | tokenizationDate   |
                              | ...                |          | ...                |
                              +--------------------+          +--------------------+
```

## Main Tables

### Users

The `users` table stores authentication information for all user types.

```typescript
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  password: text('password'),
  firstName: text('firstName'),
  lastName: text('lastName'),
  role: text('role', { enum: ['admin', 'merchant', 'customer', 'sales_rep'] }).notNull(),
  phone: text('phone'),
  emailVerified: boolean('email_verified').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  active: boolean('active').default(true),
  archived: boolean('archived').default(false),
  lastLogin: timestamp('last_login'),
  passwordResetToken: text('password_reset_token'),
  passwordResetExpiry: timestamp('password_reset_expiry')
});
```

### Merchants

The `merchants` table stores information about businesses using the platform to offer financing.

```typescript
export const merchants = pgTable('merchants', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  address: text('address'),
  city: text('city'),
  state: text('state'),
  zipCode: text('zip_code'),
  businessType: text('business_type'),
  userId: integer('user_id').references(() => users.id),
  verified: boolean('verified').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  active: boolean('active').default(true),
  archived: boolean('archived').default(false),
  contactName: text('contact_name'),
  taxId: text('tax_id'),
  website: text('website'),
  businessEstablished: timestamp('business_established'),
  logoUrl: text('logo_url')
});
```

### Customers

The `customers` table stores information about end users who receive financing.

```typescript
export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  address: text('address'),
  city: text('city'),
  state: text('state'),
  zipCode: text('zip_code'),
  userId: integer('user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  active: boolean('active').default(true),
  archived: boolean('archived').default(false),
  dateOfBirth: timestamp('date_of_birth'),
  ssn: text('ssn'),
  employmentStatus: text('employment_status'),
  annualIncome: numeric('annual_income'),
  creditScore: integer('credit_score')
});
```

### Contracts

The `contracts` table stores financing agreements between merchants and customers.

```typescript
export const contracts = pgTable('contracts', {
  id: serial('id').primaryKey(),
  contractNumber: text('contract_number').notNull().unique(),
  merchantId: integer('merchant_id').notNull().references(() => merchants.id),
  customerId: integer('customer_id').references(() => customers.id),
  amount: numeric('amount').notNull(),
  downPayment: numeric('down_payment').default('0'),
  financedAmount: numeric('financed_amount').notNull(),
  termMonths: integer('term_months').notNull(),
  interestRate: numeric('interest_rate').notNull(),
  monthlyPayment: numeric('monthly_payment').notNull(),
  status: text('status', { enum: ['active', 'pending', 'completed', 'declined', 'cancelled', 'cancellation_requested'] }).notNull().default('pending'),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  archived: boolean('archived').default(false),
  description: text('description'),
  completedAt: timestamp('completed_at'),
  archivedAt: timestamp('archived_at'),
  archivedReason: text('archived_reason'),
  
  // Cancellation fields
  cancellationRequestedAt: timestamp('cancellation_requested_at'),
  cancellationReason: text('cancellation_reason'),
  cancellationNotes: text('cancellation_notes'),
  cancellationApprovedAt: timestamp('cancellation_approved_at'),
  cancellationApprovedBy: integer('cancellation_approved_by').references(() => users.id),
  cancellationDeniedAt: timestamp('cancellation_denied_at'),
  cancellationDeniedBy: integer('cancellation_denied_by').references(() => users.id),
  cancellationDenialReason: text('cancellation_denial_reason'),
  cancellationRejectionNotes: text('cancellation_rejection_notes'),
  
  // Tokenization fields
  tokenized: boolean('tokenized').default(false),
  purchasedByShifi: boolean('purchased_by_shifi').default(false),
  tokenizationStatus: text('tokenization_status').default('pending'),
  tokenId: text('token_id'),
  smartContractAddress: text('smart_contract_address'),
  blockchainTransactionHash: text('blockchain_transaction_hash'),
  blockNumber: integer('block_number'),
  tokenizationDate: timestamp('tokenization_date'),
  tokenMetadata: text('token_metadata'),
  tokenizationError: text('tokenization_error')
});
```

### Contract Payments

The `contractPayments` table tracks payments made against contracts.

```typescript
export const contractPayments = pgTable('contract_payments', {
  id: serial('id').primaryKey(),
  contractId: integer('contract_id').notNull().references(() => contracts.id),
  amount: numeric('amount').notNull(),
  paymentDate: timestamp('payment_date').defaultNow(),
  status: text('status', { enum: ['pending', 'completed', 'failed'] }).notNull().default('pending'),
  paymentMethod: text('payment_method'),
  transactionId: text('transaction_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});
```

### Contract Cancellation Requests

The `contractCancellationRequests` table manages the contract cancellation workflow.

```typescript
export const contractCancellationRequests = pgTable('contract_cancellation_requests', {
  id: serial('id').primaryKey(),
  contractId: integer('contract_id').notNull().references(() => contracts.id),
  merchantId: integer('merchant_id').notNull().references(() => merchants.id),
  requestedBy: integer('requested_by').notNull().references(() => users.id),
  requestDate: timestamp('request_date').defaultNow(),
  requestReason: text('request_reason').notNull(),
  requestNotes: text('request_notes'),
  status: text('status', { enum: ['pending', 'under_review', 'approved', 'denied', 'processed'] }).notNull().default('pending'),
  reviewedBy: integer('reviewed_by').references(() => users.id),
  reviewDate: timestamp('review_date'),
  reviewNotes: text('review_notes'),
  approvedAt: timestamp('approved_at'),
  deniedAt: timestamp('denied_at'),
  denialReason: text('denial_reason'),
  processedAt: timestamp('processed_at'),
  refundAmount: numeric('refund_amount'),
  refundProcessedAt: timestamp('refund_processed_at'),
  adjustmentAmount: numeric('adjustment_amount'),
  adjustmentProcessedAt: timestamp('adjustment_processed_at')
});
```

### Communications

The `communications` table stores messages between different users in the system.

```typescript
export const communications = pgTable('communications', {
  id: serial('id').primaryKey(),
  senderId: integer('sender_id').notNull().references(() => users.id),
  senderType: text('sender_type', { enum: ['admin', 'merchant', 'customer'] }).notNull(),
  receiverId: integer('receiver_id').notNull().references(() => users.id),
  receiverType: text('receiver_type', { enum: ['admin', 'merchant', 'customer'] }).notNull(),
  content: text('content').notNull(),
  timestamp: timestamp('timestamp').defaultNow(),
  read: boolean('read').default(false),
  archived: boolean('archived').default(false),
  conversationId: text('conversation_id').notNull(),
  type: text('type', { enum: ['text', 'notification', 'system'] }).notNull().default('text')
});
```

### Notifications

The `notifications` table manages system notifications for users.

```typescript
export const notifications = pgTable('in_app_notifications', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  userType: text('user_type', { enum: ['admin', 'merchant', 'customer'] }).notNull(),
  type: text('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  isRead: boolean('is_read').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  metadata: text('metadata'),
  archivedAt: timestamp('archived_at')
});
```

### Plaid Connections

The `plaidConnections` table manages connections to the Plaid banking API.

```typescript
export const plaidConnections = pgTable('plaid_connections', {
  id: serial('id').primaryKey(),
  merchantId: integer('merchant_id').notNull().references(() => merchants.id),
  itemId: text('item_id').notNull(),
  accessToken: text('access_token').notNull(),
  accountId: text('account_id'),
  accountName: text('account_name'),
  accountType: text('account_type'),
  accountSubtype: text('account_subtype'),
  institutionId: text('institution_id'),
  institutionName: text('institution_name'),
  status: text('status', { enum: ['active', 'error', 'pending'] }).notNull().default('pending'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  lastSync: timestamp('last_sync'),
  error: text('error')
});
```

### Blockchain Data

The `smartContractTokens` table stores blockchain tokenization data.

```typescript
export const smartContractTokens = pgTable('smart_contract_tokens', {
  id: serial('id').primaryKey(),
  contractId: integer('contract_id').notNull().references(() => contracts.id).unique(),
  tokenId: text('token_id').notNull(),
  smartContractAddress: text('smart_contract_address').notNull(),
  blockchainTransactionHash: text('blockchain_transaction_hash').notNull(),
  tokenizationDate: timestamp('tokenization_date').notNull(),
  blockNumber: integer('block_number'),
  tokenMetadata: text('token_metadata'),
  status: text('status', { enum: ['active', 'cancelled', 'completed'] }).notNull().default('active'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});
```

## Relationships

### One-to-One Relationships

- User to Merchant: Each merchant account is associated with exactly one user
- User to Customer: Each customer account is associated with exactly one user
- Contract to Smart Contract Token: Each contract can have exactly one token representation

### One-to-Many Relationships

- Merchant to Contracts: A merchant can have multiple contracts
- Customer to Contracts: A customer can have multiple contracts
- Contract to Payments: A contract can have multiple payments
- Contract to Cancellation Requests: A contract can have multiple cancellation requests (historical)
- User to Notifications: A user can have multiple notifications

### Many-to-Many Relationships

- Users to Communications: Users can send and receive multiple communications
- Merchants to Plaid Connections: A merchant can have multiple Plaid bank connections

## Data Flow

### Contract Creation Flow

1. Merchant creates a contract for a customer
2. System generates a unique contract number
3. Contract is stored with status 'pending'
4. When approved, status changes to 'active'
5. Monthly payments are tracked in the contract_payments table
6. When all payments are made, status changes to 'completed'

### Contract Cancellation Flow

1. Merchant requests cancellation via the contract_cancellation_requests table
2. Admin reviews the request (status: 'under_review')
3. Admin approves or denies the request
4. If approved, the contract status changes to 'cancelled'
5. Refund or adjustment amounts are recorded

### Tokenization Flow

1. Admin approves a contract for tokenization
2. System creates a token record in smart_contract_tokens
3. Blockchain transaction details are recorded
4. Contract is marked as 'tokenized'

## Data Types

| PostgreSQL Type | JavaScript/TypeScript Type | Description |
|----------------|----------------------------|-------------|
| serial         | number                     | Auto-incrementing integer |
| integer        | number                     | Whole number |
| numeric        | number                     | Decimal number (for currency) |
| text           | string                     | Variable-length string |
| boolean        | boolean                    | True/false value |
| timestamp      | Date                       | Date and time |
| jsonb          | object                     | JSON data |

## Data Validation

The application uses Zod schemas for data validation:

```typescript
// Example of insert schema with validation
export const insertUserSchema = createInsertSchema(users)
  .extend({
    email: z.string().email(),
    password: z.string().min(8),
    role: z.enum(['admin', 'merchant', 'customer', 'sales_rep'])
  })
  .omit({ id: true, createdAt: true, updatedAt: true });
```

## Migrations

The database schema is managed through Drizzle migrations:

1. Schema changes are defined in `shared/schema.ts`
2. Migrations are generated using Drizzle Kit
3. Migrations are applied automatically during application startup

To manually push schema changes:

```bash
npm run db:push
```

## Indexes

The database includes several indexes for optimizing query performance:

- Primary key indexes on all `id` columns
- Foreign key indexes on relationship columns
- Unique indexes on important identifiers (email, contractNumber, etc.)
- Composite indexes for common query patterns

## Security Considerations

The database implementation includes several security measures:

1. Passwords are hashed using bcrypt before storage
2. Sensitive data is encrypted in the application layer
3. Database access is controlled through connection pooling
4. SQL injection is prevented through parameterized queries
5. Access controls are implemented at the application level

## Reporting Queries

Common reporting queries used by the application:

### Contract Status Summary

```sql
SELECT 
  status, 
  COUNT(*) as count, 
  SUM(amount) as total_amount
FROM contracts
GROUP BY status;
```

### Monthly Payment Collection

```sql
SELECT 
  EXTRACT(YEAR FROM payment_date) as year,
  EXTRACT(MONTH FROM payment_date) as month,
  COUNT(*) as payment_count,
  SUM(amount) as collected_amount
FROM contract_payments
WHERE status = 'completed'
GROUP BY year, month
ORDER BY year, month;
```

### Merchant Performance

```sql
SELECT 
  m.id,
  m.name,
  COUNT(c.id) as contract_count,
  SUM(c.amount) as total_financed,
  AVG(c.interestRate) as avg_interest_rate
FROM merchants m
JOIN contracts c ON m.id = c.merchantId
GROUP BY m.id, m.name
ORDER BY total_financed DESC;
```

## Connection Configuration

The database connection is configured through environment variables:

```
DATABASE_URL=postgresql://username:password@host:port/database
```

In development, you can use:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/shifi
```

## Performance Considerations

To optimize database performance:

1. Use appropriate indexes for frequently queried columns
2. Limit the amount of data returned in queries
3. Use pagination for large result sets
4. Optimize joins to reduce query complexity
5. Consider caching frequently accessed data

## Backup and Recovery

The application implements database backup through:

1. Regular automated backups
2. Point-in-time recovery
3. Transaction logs for auditing

## Conclusion

The ShiFi platform database is designed for:

- Data integrity through relationships and constraints
- Performance through appropriate indexes and query optimization
- Security through encryption and access controls
- Extensibility through a well-structured schema
- Maintainability through clear organization and documentation