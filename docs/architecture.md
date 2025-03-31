# Architecture Documentation

This document provides a comprehensive overview of the architectural design, patterns, and decisions made in our financial platform application.

## System Overview

The ShiFi platform is a fintech application that enables merchants to offer financing options to their customers through an advanced blockchain-based tokenization system.

The application follows a modern full-stack architecture with the following key components:

1. **Frontend**: React-based single-page application (SPA)
2. **Backend**: Node.js/Express.js API server
3. **Database**: PostgreSQL database for structured data storage
4. **Authentication**: Session-based authentication with passwordless options
5. **External Integrations**: Plaid, Stripe, OpenAI, Email, SMS services
6. **Blockchain**: Ethereum-based contract tokenization

## Architecture Diagram

```
+---------------------+    +------------------+    +------------------+
|                     |    |                  |    |                  |
|    Client Browser   |<-->|  Express Server  |<-->|   PostgreSQL     |
|    (React SPA)      |    |  (Node.js)       |    |   Database       |
|                     |    |                  |    |                  |
+---------------------+    +------------------+    +------------------+
                                   ^
                                   |
                                   v
          +------------------------------------------------------+
          |                                                      |
          |                 External Services                    |
          |                                                      |
          | +------------+ +--------+ +-------+ +-------------+  |
          | |            | |        | |       | |             |  |
          | |   Plaid    | | Stripe | | Twilio| |   OpenAI    |  |
          | |  (Banking) | |(Payment)| | (SMS) | |    (AI)     |  |
          | |            | |        | |       | |             |  |
          | +------------+ +--------+ +-------+ +-------------+  |
          |                                                      |
          +------------------------------------------------------+
                                   ^
                                   |
                                   v
                         +-------------------+
                         |                   |
                         |   Ethereum        |
                         |   Blockchain      |
                         |                   |
                         +-------------------+
```

## Frontend Architecture

### Technology Stack

- **Framework**: React
- **Build Tool**: Vite
- **Routing**: Wouter
- **State Management**: React Query, Context API
- **UI Components**: Custom components with Tailwind CSS and shadcn
- **Form Handling**: React Hook Form with Zod validation

### Code Organization

The frontend code is organized according to feature/module-based structure:

```
client/src/
├── components/           # Reusable UI components
│   ├── ui/               # Base UI components
│   ├── layout/           # Layout components
│   ├── customer/         # Customer-specific components
│   ├── merchant/         # Merchant-specific components
│   └── admin/            # Admin-specific components
├── pages/                # Page components
├── lib/                  # Utility functions and hooks
│   ├── api.ts            # API client
│   ├── queryClient.ts    # React Query configuration
│   ├── csrf.ts           # CSRF handling
│   └── utils.ts          # General utilities
├── hooks/                # Custom React hooks
├── contexts/             # Context providers
├── types/                # TypeScript type definitions
└── App.tsx               # Main application component
```

### Routing

The application uses Wouter for client-side routing, with routes defined in `App.tsx`:

- Public routes (login, signup, landing pages)
- Protected routes requiring authentication
- Role-based routes (admin, merchant, customer)

### State Management

The application uses a hybrid approach to state management:

1. **Server State**: React Query for all data fetching, caching, and synchronization with the server
2. **Global UI State**: React Context API for authentication state, theme, notifications
3. **Component State**: Local React state for component-specific UI state

## Backend Architecture

### Technology Stack

- **Framework**: Express.js
- **Language**: TypeScript
- **Database ORM**: Drizzle ORM
- **Authentication**: express-session with PostgreSQL session store
- **Security**: helmet, CSRF protection, rate limiting

### Code Organization

The backend code follows a layered architecture:

```
server/
├── index.ts             # Application entry point
├── routes.ts            # API route definitions
├── routes/              # Route handlers organized by feature
├── middleware/          # Express middleware
├── services/            # Business logic services
├── utils/               # Utility functions
└── storage.ts           # Database access layer
```

### API Design

The API follows RESTful principles:

- Resource-based URLs
- Appropriate HTTP methods (GET, POST, PUT, DELETE)
- JSON request/response format
- Consistent error handling
- Authentication via session cookies
- CSRF protection for state-changing operations

### Middleware Pipeline

The Express application uses a middleware pipeline for request processing:

1. **Helmet**: Security headers
2. **CORS**: Cross-origin request handling
3. **Body Parser**: Request body parsing
4. **Cookie Parser**: Cookie parsing
5. **Session**: Session management
6. **CSRF Protection**: CSRF token validation
7. **Rate Limiting**: Request rate limiting
8. **Routes**: API route handlers
9. **Error Handling**: Global error handler

## Database Architecture

### Schema Overview

The database schema is defined using Drizzle ORM with entities described in `shared/schema.ts`.

Key entities include:
- Users
- Merchants
- Customers
- Contracts
- Contract Cancellation Requests
- Communications
- Notifications
- Plaid connections
- Verification records

See the [Database Documentation](database.md) for detailed schema information.

### Data Access Pattern

Database access follows the repository pattern through the Storage interface:

1. API routes call methods on the Storage interface
2. Storage implementation uses Drizzle ORM to interact with PostgreSQL
3. All SQL queries are abstracted behind the Storage interface
4. Complex operations use transactions to ensure data integrity

## Authentication System

The application uses a multi-faceted authentication system:

1. **Session-based Auth**: Traditional email/password + session cookie
2. **Passwordless Auth**: Magic links and OTP codes
3. **Role-Based Access Control**: Different capabilities for admins, merchants, and customers

### Authentication Flow

1. User authenticates via login, magic link, or OTP
2. Server creates a session and sets a session cookie
3. Subsequent requests include the session cookie for authentication
4. Server validates the session and authorizes the user based on their role
5. Protected API endpoints and UI routes check for authentication and authorization

## External Integrations

### Plaid Integration

Plaid integration enables banking functionality:

1. **Account Linking**: Merchants connect their bank accounts via Plaid Link
2. **Asset Verification**: Generate asset reports for underwriting
3. **Payments**: Facilitate transfers between accounts
4. **Merchant Onboarding**: Streamlined KYC/KYB processes

### OpenAI Integration

The application integrates with OpenAI for:

1. **Financial Sherpa**: AI-powered financial assistant for customers
2. **Contract Analysis**: Automated contract review
3. **Financial Insights**: AI-generated insights from financial data

### Email and SMS Services

Communication services integrated for notifications:

1. **SendGrid**: Email delivery for system notifications, magic links
2. **Twilio**: SMS delivery for OTP codes and alerts

## Blockchain Architecture

The application tokenizes financing contracts on the Ethereum blockchain:

1. **Smart Contracts**: Custom-developed smart contracts for representing financing agreements
2. **Tokenization Process**: Process of converting traditional contracts to on-chain tokens
3. **Blockchain Transactions**: Recording contract details as immutable transactions

### Tokenization Flow

1. Admin approves a contract for tokenization
2. System creates a token representation of the contract
3. Contract details are submitted to the blockchain
4. Transaction is recorded and tracked
5. Contract is updated with blockchain transaction details

## Security Architecture

### Defense-in-Depth Strategy

The application implements multiple layers of security:

1. **Network Security**: HTTPS, secure headers, CORS
2. **Authentication**: Secure session management, password hashing
3. **Authorization**: Role-based access control
4. **Input Validation**: Form validation, API request validation
5. **Output Encoding**: XSS prevention
6. **CSRF Protection**: Token-based CSRF prevention
7. **Rate Limiting**: Prevent brute force and DoS attacks
8. **Secure Credentials**: Environment-based secrets management
9. **Data Protection**: In-transit and at-rest encryption

### Sensitive Data Handling

The application follows best practices for sensitive data:

1. **Passwords**: Bcrypt hashing
2. **API Keys**: Environment variables, not stored in code
3. **Financial Data**: Encrypted at rest
4. **PII**: Limited collection, proper access controls

## Error Handling and Logging

### Error Handling Strategy

The application implements a comprehensive error handling strategy:

1. **Frontend**: React error boundaries, axios interceptors
2. **Backend**: Global error middleware, structured error responses
3. **Expected Errors**: Type-specific error handling (validation, auth, etc.)
4. **Unexpected Errors**: Graceful degradation, logging

### Logging System

Structured logging throughout the application:

1. **Transaction Logs**: Record of all significant business transactions
2. **Error Logs**: Detailed error information for debugging
3. **Audit Logs**: Security-relevant events for compliance
4. **Usage Logs**: Application usage patterns

## Performance Considerations

The application architecture addresses performance through:

1. **Frontend Optimization**: Code splitting, lazy loading, memoization
2. **Backend Efficiency**: Database query optimization, connection pooling
3. **Caching Strategy**: React Query caching, API response caching
4. **Database Indexing**: Strategic indexes for common queries
5. **Load Management**: Rate limiting, pagination

## Deployment Architecture

The application is designed for deployment on Replit:

1. **Build Process**: Vite for frontend, TypeScript compilation for backend
2. **Environment Config**: Environment-based configuration
3. **Database**: PostgreSQL database connection
4. **Static Assets**: Optimized and served via Vite

## Development Workflow

The development workflow follows these principles:

1. **TypeScript**: Type safety throughout the codebase
2. **Shared Types**: Common types shared between frontend and backend
3. **Component Documentation**: Storybook for UI components
4. **API Documentation**: Comprehensive API docs maintained with the code
5. **Database Schema Management**: Drizzle ORM for schema definition and migrations

## Future Architecture Considerations

Areas for future architectural evolution:

1. **Microservices**: Potential decomposition of monolith as features grow
2. **Real-time Features**: WebSocket infrastructure for real-time updates
3. **Analytics Pipeline**: Dedicated data analytics infrastructure
4. **Mobile Support**: Potential React Native implementation
5. **Multi-tenancy**: Enhanced isolation between merchants

## Conclusion

The ShiFi platform architecture balances modern web development practices with the specific needs of a financial application. The architecture prioritizes security, maintainability, and extensibility while providing a responsive and feature-rich user experience.