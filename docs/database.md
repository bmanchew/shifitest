# Database Schema Documentation

## Core Tables

### users
Primary user account information
- **id**: Primary key, serial
  - Auto-incrementing identifier
  - Used as foreign key reference in related tables
- **email**: text, unique, not null
  - User's email address
  - Used for authentication and communication
  - Must be unique across the system
- **password**: text, not null
  - Hashed password using bcrypt
  - Never stored in plain text
- **firstName**: text
  - User's first name
  - Optional for flexibility
- **lastName**: text
  - User's last name
  - Optional for flexibility
- **name**: text
  - Legacy field for backward compatibility
  - Combined name field
- **role**: userRoleEnum ('admin', 'merchant', 'customer')
  - Determines user access levels
  - Used for authorization
- **phone**: text
  - Contact number
  - Stored in E.164 format
- **createdAt**: timestamp
  - Account creation timestamp
  - Automatically set on record creation

### merchants
Merchant business information
- **id**: Primary key, serial
  - Auto-incrementing identifier
  - Referenced by contracts table
- **name**: text, not null
  - Business name
  - Used in contracts and displays
- **contactName**: text, not null
  - Primary contact person
  - Used for communications
- **email**: text, not null, unique
  - Business email address
  - Used for notifications
- **phone**: text, not null
  - Business contact number
  - Used for urgent communications
- **address**: text
  - Business location
  - Used for verification
- **active**: boolean, default true
  - Account status indicator
  - Controls access to platform
- **archived**: boolean, default false
  - Soft delete flag
  - Preserves historical data
- **createdAt**: timestamp
  - Record creation time
  - Auto-set on creation
- **userId**: integer, references users
  - Links to user account
  - Foreign key constraint

### contracts
Financial agreements
- **id**: Primary key, serial
  - Unique contract identifier
  - Referenced by related tables
- **contractNumber**: text, not null, unique
  - Human-readable identifier
  - Format: "SHI-XXXX"
- **merchantId**: integer, references merchants
  - Link to merchant account
  - Foreign key constraint
- **customerId**: integer, references users
  - Link to customer account
  - Foreign key constraint
- **amount**: double precision, not null
  - Total contract value
  - In base currency units
- **downPayment**: double precision, not null
  - Initial payment amount
  - Must be less than total amount
- **financedAmount**: double precision, not null
  - Amount being financed
  - amount - downPayment
- **termMonths**: integer, not null, default 24
  - Contract duration
  - Used for payment calculation
- **interestRate**: double precision, not null, default 0
  - Annual interest rate
  - Percentage as decimal
- **monthlyPayment**: double precision, not null
  - Recurring payment amount
  - Calculated based on terms
- **status**: contractStatusEnum
  - Current contract state
  - Affects payment processing
- **currentStep**: applicationStepEnum
  - Application progress
  - Controls flow progression
- **purchasedByShifi**: boolean, default false
  - Transfer status
  - Affects payment routing
- **createdAt**: timestamp
  - Contract creation time
  - Auto-set on creation
- **completedAt**: timestamp
  - Contract completion time
  - Set on final approval
- **phoneNumber**: text
  - Customer contact
  - Used for notifications

## Application Process

### applicationProgress
Tracks application steps
- **id**: Primary key, serial
  - Unique progress identifier
  - For tracking purposes
- **contractId**: integer, references contracts
  - Associated contract
  - Foreign key constraint
- **step**: applicationStepEnum
  - Current process step
  - Controls flow progression
- **completed**: boolean, default false
  - Step completion status
  - Gates progression
- **data**: text
  - Step-specific JSON data
  - Stores form responses
- **createdAt**: timestamp
  - Step initiation time
  - Auto-set on creation
- **completedAt**: timestamp
  - Step completion time
  - Set on step completion

## Underwriting

### underwritingData
Credit evaluation data
- **id**: Primary key, serial
  - Unique evaluation identifier
  - For tracking purposes
- **userId**: integer, references users
  - Customer reference
  - Foreign key constraint
- **contractId**: integer, references contracts
  - Associated contract
  - Foreign key constraint
- **creditTier**: creditTierEnum
  - Risk assessment level
  - Determines terms
- **creditScore**: integer
  - Numeric credit score
  - From credit bureau
- **annualIncome**: double precision
  - Yearly income
  - Verified amount
- **dtiRatio**: double precision
  - Debt-to-income ratio
  - As decimal percentage
- **totalPoints**: integer, not null
  - Composite score
  - Used for decisioning
- **rawPreFiData**: text
  - Pre-Fi API response
  - JSON stringified
- **rawPlaidData**: text
  - Plaid analysis data
  - JSON stringified

## Integration Tables

### plaidMerchants
Plaid service integration
- **id**: Primary key, serial
  - Unique integration ID
  - For tracking purposes
- **merchantId**: integer, references merchants
  - Associated merchant
  - Foreign key constraint
- **plaidCustomerId**: text
  - External customer ID
  - From Plaid system
- **accessToken**: text
  - Secure token
  - For API access
- **accountId**: text
  - Primary account reference
  - For transactions

### assetReports
Financial verification documents
- **id**: Primary key, serial
  - Unique report identifier
  - For tracking purposes
- **userId**: integer, references users
  - Customer reference
  - Foreign key constraint
- **contractId**: integer, references contracts
  - Associated contract
  - Foreign key constraint
- **assetReportId**: text, not null
  - External reference
  - From Plaid
- **status**: text, default 'pending'
  - Report status
  - Controls processing
- **analysisData**: text
  - Analysis results
  - JSON stringified

## Monitoring

### merchantPerformance
Business metrics tracking
- **id**: Primary key, serial
  - Unique metric ID
  - For tracking purposes
- **merchantId**: integer, references merchants
  - Associated merchant
  - Foreign key constraint
- **performanceScore**: double precision, not null
  - Composite rating
  - Calculated metric
- **grade**: text, not null
  - Letter grade rating
  - For easy reference
- **defaultRate**: double precision
  - Payment default percentage
  - Risk indicator
- **customerSatisfactionScore**: double precision
  - Rating metric
  - From surveys