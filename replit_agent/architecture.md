# Architecture Overview

## 1. Overview

This application is a financial services platform that facilitates installment payment processing between merchants and customers. The platform handles various aspects of financial contracts including application processing, KYC (Know Your Customer) verification, payment scheduling, bank account connections, and contract signing.

The architecture follows a modern full-stack approach with a clear separation between frontend and backend components. The system uses a RESTful API architecture and implements a PostgreSQL database for data persistence.

## 2. System Architecture

### 2.1 High-Level Architecture

The application follows a client-server architecture with:

- **Frontend**: React-based single-page application with TypeScript
- **Backend**: Node.js Express server with TypeScript
- **Database**: PostgreSQL database managed through Drizzle ORM
- **Authentication**: JWT-based authentication system
- **External APIs**: Integration with multiple financial and identity verification services

### 2.2 Core Components

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│    Frontend     │      │     Backend     │      │    Database     │
│    (React)      │<────>│    (Express)    │<────>│  (PostgreSQL)   │
└─────────────────┘      └─────────────────┘      └─────────────────┘
                               │
                               │
                               ▼
                         ┌─────────────────┐
                         │  External APIs  │
                         │  - Plaid        │
                         │  - DiDit (KYC)  │
                         │  - ThanksRoger  │
                         │  - Pre-Fi       │
                         │  - Twilio       │
                         │  - CFPB         │
                         └─────────────────┘
```

## 3. Key Components

### 3.1 Frontend

- **Framework**: React with TypeScript
- **UI Components**: Uses Shadcn UI components system with Radix UI primitives
- **State Management**: Uses React Query for server state and React Context for application state
- **Routing**: Uses Wouter/React Router for application routing
- **Styling**: TailwindCSS for styling
- **Form Handling**: React Hook Form with Zod validation

**Key Features**:
- Role-based interfaces (Admin, Merchant, Customer)
- Application process flow with multi-step forms
- Dashboard analytics and reporting
- Contract management interfaces

### 3.2 Backend

- **Framework**: Express.js with TypeScript
- **API Layer**: RESTful API endpoints organized by domain
- **Data Access**: Storage service abstraction for database operations
- **Authentication**: JWT-based authentication with role-based authorization
- **Logging**: Structured logging system with correlation IDs
- **Error Handling**: Centralized error handling with consistent response formats

**Key Services**:
- Authentication and authorization
- Contract management
- Application progress tracking
- Payment processing
- KYC verification
- Merchant and customer management
- Reporting and analytics

### 3.3 Database

- **Type**: PostgreSQL
- **ORM**: Drizzle ORM with PostgreSQL driver
- **Connection**: Uses Neon serverless Postgres (@neondatabase/serverless)
- **Migration**: Uses Drizzle Kit for schema migrations

**Core Entities**:
- Users (with role-based permissions)
- Merchants
- Contracts
- Application Progress
- Logs
- Underwriting Data
- Asset Reports
- Portfolio Monitoring
- Complaints Data

### 3.4 External Integrations

- **Plaid**: Bank account connection and verification
- **DiDit**: Identity verification (KYC)
- **ThanksRoger**: Contract generation and signing
- **Pre-Fi**: Credit reporting and underwriting
- **Twilio**: SMS notifications
- **CFPB**: Consumer Financial Protection Bureau data for compliance and analytics

## 4. Data Flow

### 4.1 Contract Application Flow

```
┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐
│    Terms   │───>│     KYC    │───>│    Bank    │───>│   Payment  │───>│   Signing  │
│ Acceptance │    │Verification│    │ Connection │    │  Schedule  │    │            │
└────────────┘    └────────────┘    └────────────┘    └────────────┘    └────────────┘
```

1. **Contract Creation**: Merchant creates a contract for a customer
2. **Terms Acceptance**: Customer reviews and accepts contract terms
3. **KYC Verification**: Customer verifies identity through DiDit service
4. **Bank Connection**: Customer connects bank account through Plaid
5. **Payment Schedule**: System generates payment schedule
6. **Contract Signing**: Customer signs final contract through ThanksRoger
7. **Activation**: Contract is activated and payment processing begins

### 4.2 Authentication Flow

1. User submits login credentials
2. Server validates credentials against stored data
3. On successful validation, server generates a JWT
4. JWT is returned to client and stored
5. Subsequent requests include JWT in Authorization header
6. Server validates JWT and authorizes requests based on user role

## 5. External Dependencies

### 5.1 Frontend Dependencies

- **@radix-ui**: UI component primitives
- **@tanstack/react-query**: Data fetching and cache management
- **@tanstack/react-table**: Data table management
- **@tanstack/react-router**: Routing (being used alongside Wouter)
- **@hookform/resolvers**: Form validation
- **class-variance-authority**: Component styling variants
- **tailwindcss**: Utility-first CSS framework
- **recharts**: Chart visualization library (referenced in code)

### 5.2 Backend Dependencies

- **express**: Web server framework
- **@neondatabase/serverless**: PostgreSQL serverless client
- **drizzle-orm**: ORM for database operations
- **jsonwebtoken**: JWT authentication
- **zod**: Schema validation
- **twilio**: SMS integration
- **axios**: HTTP client for external API calls
- **uuid**: Unique identifier generation
- **ws**: WebSocket implementation for Neon database

### 5.3 Development Dependencies

- **vite**: Frontend build tool
- **typescript**: Type checking
- **esbuild**: JavaScript bundler for server code
- **drizzle-kit**: Database schema migration tool

## 6. Deployment Strategy

The application is configured for deployment on Replit with the following components:

### 6.1 Environment Configuration

- **Node.js**: Uses Node.js 20
- **Database**: PostgreSQL 16
- **Ports**: Multiple ports configured for different services

### 6.2 Build and Run Process

- **Development**: `npm run dev` using tsx to run the server
- **Build**: Vite for frontend, esbuild for backend
- **Start**: `NODE_ENV=production node dist/index.js`

### 6.3 Cloud Deployment

- **Target**: Cloud Run (specified in .replit configuration)
- **Build Command**: `npm run build`
- **Run Command**: `npm run start`
- **Port Mapping**: Various ports mapped for external access

### 6.4 Database Migration Strategy

- Schema migrations using Drizzle Kit
- Manual migration scripts for specific data changes (like normalizing phone numbers)
- Incremental approach with careful verification of changes

## 7. Security Considerations

### 7.1 Data Security

- Sensitive customer information is handled according to financial regulations
- KYC data is processed through specialized third-party services
- Logging system designed to avoid storing sensitive data in logs

### 7.2 Authentication and Authorization

- JWT-based authentication with appropriate expiration
- Role-based access control (Admin, Merchant, Customer)
- API endpoint protection based on user roles

### 7.3 External API Security

- API keys stored as environment variables
- Rate limiting implementation for external API calls
- Fallback mechanisms for API failures

## 8. Scalability Considerations

- Serverless database connection for scalable database operations
- Separation of concerns allowing for component-level scaling
- Query caching and optimization for improved performance
- Stateless authentication allowing for horizontal scaling

## 9. Monitoring and Logging

- Comprehensive logging system with structured logs
- Request correlation IDs for tracing requests through the system
- Error categorization and severity levels
- Audit logging for sensitive operations