# API Documentation

This document provides a comprehensive reference for the API endpoints available in the ShiFi platform.

## Authentication

All API requests (except for public endpoints) require authentication. The application uses a session-based authentication system.

### Authentication Headers

For authenticated requests:
- Session cookie is automatically included with requests
- CSRF token must be included for non-GET requests

### CSRF Protection

All state-changing requests (POST, PUT, DELETE) require a valid CSRF token:

1. Get a CSRF token:
   ```
   GET /api/csrf-token
   ```

2. Include the token in subsequent requests:
   ```
   X-CSRF-Token: {token}
   ```

## Auth API

### Login

```
POST /api/auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "userType": "merchant" // or "admin" or "customer"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 123,
    "email": "user@example.com",
    "name": "User Name",
    "userType": "merchant"
  }
}
```

### Logout

```
POST /api/auth/logout
```

**Response:**
```json
{
  "success": true
}
```

### Get Current User

```
GET /api/auth/user
```

**Response:**
```json
{
  "id": 123,
  "email": "user@example.com",
  "name": "User Name",
  "userType": "merchant"
}
```

### Request Password Reset

```
POST /api/auth/forgot-password
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "userType": "merchant"
}
```

**Response:**
```json
{
  "success": true,
  "message": "If an account exists with that email, a password reset link has been sent."
}
```

### Reset Password

```
POST /api/auth/reset-password
```

**Request Body:**
```json
{
  "token": "reset-token",
  "password": "newPassword123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Password has been reset successfully."
}
```

## Merchant API

### Get Merchant Profile

```
GET /api/merchant/profile
```

**Response:**
```json
{
  "id": 123,
  "name": "Merchant Business",
  "email": "business@example.com",
  "phone": "555-123-4567",
  "address": "123 Business St",
  "city": "Businessville",
  "state": "CA",
  "zipCode": "90210",
  "businessType": "retail",
  "verified": true
}
```

### Update Merchant Profile

```
PUT /api/merchant/profile
```

**Request Body:**
```json
{
  "name": "Updated Business Name",
  "phone": "555-987-6543",
  "address": "456 Business Ave",
  "city": "Commerce City",
  "state": "NY",
  "zipCode": "10001",
  "businessType": "service"
}
```

**Response:**
```json
{
  "success": true,
  "profile": {
    "id": 123,
    "name": "Updated Business Name",
    "email": "business@example.com",
    "phone": "555-987-6543",
    "address": "456 Business Ave",
    "city": "Commerce City",
    "state": "NY",
    "zipCode": "10001",
    "businessType": "service",
    "verified": true
  }
}
```

### Get Merchant Contracts

```
GET /api/merchant/contracts
```

**Query Parameters:**
- `status` (optional): Filter by status (active, completed, cancelled)
- `page` (optional): Page number for pagination
- `limit` (optional): Number of items per page

**Response:**
```json
{
  "contracts": [
    {
      "id": 456,
      "customerId": 789,
      "customerName": "Customer Name",
      "amount": 5000,
      "interestRate": 0.05,
      "termMonths": 12,
      "status": "active",
      "startDate": "2023-01-15T00:00:00Z",
      "endDate": "2024-01-15T00:00:00Z",
      "monthlyPayment": 428.04,
      "remainingBalance": 3500.25,
      "contractNumber": "CON-12345"
    }
  ],
  "pagination": {
    "total": 42,
    "pages": 5,
    "currentPage": 1,
    "limit": 10
  }
}
```

### Create Contract

```
POST /api/merchant/contracts
```

**Request Body:**
```json
{
  "customerId": 789,
  "amount": 5000,
  "interestRate": 0.05,
  "termMonths": 12,
  "startDate": "2023-01-15T00:00:00Z",
  "description": "Financing for product purchase"
}
```

**Response:**
```json
{
  "success": true,
  "contract": {
    "id": 456,
    "customerId": 789,
    "customerName": "Customer Name",
    "amount": 5000,
    "interestRate": 0.05,
    "termMonths": 12,
    "status": "active",
    "startDate": "2023-01-15T00:00:00Z",
    "endDate": "2024-01-15T00:00:00Z",
    "monthlyPayment": 428.04,
    "remainingBalance": 5000,
    "contractNumber": "CON-12345"
  }
}
```

### Get Contract Details

```
GET /api/merchant/contracts/:contractId
```

**Response:**
```json
{
  "id": 456,
  "customerId": 789,
  "customerName": "Customer Name",
  "amount": 5000,
  "interestRate": 0.05,
  "termMonths": 12,
  "status": "active",
  "startDate": "2023-01-15T00:00:00Z",
  "endDate": "2024-01-15T00:00:00Z",
  "monthlyPayment": 428.04,
  "remainingBalance": 3500.25,
  "paymentHistory": [
    {
      "id": 101,
      "date": "2023-02-15T00:00:00Z",
      "amount": 428.04,
      "status": "completed"
    },
    {
      "id": 102,
      "date": "2023-03-15T00:00:00Z",
      "amount": 428.04,
      "status": "completed"
    }
  ],
  "contractNumber": "CON-12345",
  "description": "Financing for product purchase",
  "tokenized": true,
  "blockchainTxId": "0x1234567890abcdef"
}
```

### Request Contract Cancellation

```
POST /api/merchant/contracts/:contractId/cancellation-request
```

**Request Body:**
```json
{
  "reason": "Customer requested cancellation",
  "notes": "Customer called to cancel the financing agreement"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Cancellation request submitted successfully",
  "requestId": 234
}
```

### Get Plaid Link Token

```
GET /api/merchant/plaid/link-token
```

**Response:**
```json
{
  "linkToken": "link-sandbox-1234567890abcdef"
}
```

### Set Plaid Access Token

```
POST /api/merchant/plaid/set-access-token
```

**Request Body:**
```json
{
  "publicToken": "public-sandbox-1234567890abcdef"
}
```

**Response:**
```json
{
  "success": true
}
```

## Customer API

### Get Customer Profile

```
GET /api/customer/profile
```

**Response:**
```json
{
  "id": 789,
  "name": "Customer Name",
  "email": "customer@example.com",
  "phone": "555-123-4567",
  "address": "123 Customer St",
  "city": "Customerville",
  "state": "CA",
  "zipCode": "90210"
}
```

### Update Customer Profile

```
PUT /api/customer/profile
```

**Request Body:**
```json
{
  "name": "Updated Customer Name",
  "phone": "555-987-6543",
  "address": "456 Customer Ave",
  "city": "Buyertown",
  "state": "NY",
  "zipCode": "10001"
}
```

**Response:**
```json
{
  "success": true,
  "profile": {
    "id": 789,
    "name": "Updated Customer Name",
    "email": "customer@example.com",
    "phone": "555-987-6543",
    "address": "456 Customer Ave",
    "city": "Buyertown",
    "state": "NY",
    "zipCode": "10001"
  }
}
```

### Get Customer Contracts

```
GET /api/customer/contracts
```

**Response:**
```json
{
  "contracts": [
    {
      "id": 456,
      "merchantId": 123,
      "merchantName": "Merchant Business",
      "amount": 5000,
      "interestRate": 0.05,
      "termMonths": 12,
      "status": "active",
      "startDate": "2023-01-15T00:00:00Z",
      "endDate": "2024-01-15T00:00:00Z",
      "monthlyPayment": 428.04,
      "remainingBalance": 3500.25,
      "contractNumber": "CON-12345"
    }
  ]
}
```

### Get Contract Details

```
GET /api/customer/contracts/:contractId
```

**Response:**
```json
{
  "id": 456,
  "merchantId": 123,
  "merchantName": "Merchant Business",
  "amount": 5000,
  "interestRate": 0.05,
  "termMonths": 12,
  "status": "active",
  "startDate": "2023-01-15T00:00:00Z",
  "endDate": "2024-01-15T00:00:00Z",
  "monthlyPayment": 428.04,
  "remainingBalance": 3500.25,
  "paymentHistory": [
    {
      "id": 101,
      "date": "2023-02-15T00:00:00Z",
      "amount": 428.04,
      "status": "completed"
    },
    {
      "id": 102,
      "date": "2023-03-15T00:00:00Z",
      "amount": 428.04,
      "status": "completed"
    }
  ],
  "contractNumber": "CON-12345",
  "description": "Financing for product purchase"
}
```

### Make Payment

```
POST /api/customer/contracts/:contractId/payments
```

**Request Body:**
```json
{
  "amount": 428.04,
  "paymentMethod": "bank_account"
}
```

**Response:**
```json
{
  "success": true,
  "payment": {
    "id": 103,
    "date": "2023-04-15T00:00:00Z",
    "amount": 428.04,
    "status": "completed"
  },
  "remainingBalance": 3072.21
}
```

## Admin API

### Get Merchants

```
GET /api/admin/merchants
```

**Query Parameters:**
- `status` (optional): Filter by status (active, pending, suspended)
- `page` (optional): Page number for pagination
- `limit` (optional): Number of items per page

**Response:**
```json
{
  "merchants": [
    {
      "id": 123,
      "name": "Merchant Business",
      "email": "business@example.com",
      "status": "active",
      "createdAt": "2023-01-01T00:00:00Z",
      "contractCount": 42
    }
  ],
  "pagination": {
    "total": 150,
    "pages": 15,
    "currentPage": 1,
    "limit": 10
  }
}
```

### Get Merchant Details

```
GET /api/admin/merchants/:merchantId
```

**Response:**
```json
{
  "id": 123,
  "name": "Merchant Business",
  "email": "business@example.com",
  "phone": "555-123-4567",
  "address": "123 Business St",
  "city": "Businessville",
  "state": "CA",
  "zipCode": "90210",
  "businessType": "retail",
  "verified": true,
  "status": "active",
  "createdAt": "2023-01-01T00:00:00Z",
  "contractCount": 42,
  "totalFinanced": 210000,
  "currentBalances": 175000
}
```

### Get Pending Cancellation Requests

```
GET /api/admin/cancellation-requests
```

**Query Parameters:**
- `status` (optional): Filter by status (pending, under_review, approved, rejected)
- `page` (optional): Page number for pagination
- `limit` (optional): Number of items per page

**Response:**
```json
{
  "requests": [
    {
      "id": 234,
      "contractId": 456,
      "contractNumber": "CON-12345",
      "merchantId": 123,
      "merchantName": "Merchant Business",
      "customerId": 789,
      "customerName": "Customer Name",
      "requestDate": "2023-05-10T00:00:00Z",
      "reason": "Customer requested cancellation",
      "notes": "Customer called to cancel the financing agreement",
      "status": "pending",
      "reviewedBy": null,
      "reviewDate": null,
      "reviewNotes": null
    }
  ],
  "pagination": {
    "total": 5,
    "pages": 1,
    "currentPage": 1,
    "limit": 10
  }
}
```

### Update Cancellation Request Status

```
PUT /api/admin/cancellation-requests/:requestId
```

**Request Body:**
```json
{
  "status": "under_review", // or "approved" or "rejected"
  "notes": "Reviewing contract details before making a decision"
}
```

**Response:**
```json
{
  "success": true,
  "request": {
    "id": 234,
    "status": "under_review",
    "reviewedBy": 999,
    "reviewDate": "2023-05-11T00:00:00Z",
    "reviewNotes": "Reviewing contract details before making a decision"
  }
}
```

### View System Statistics

```
GET /api/admin/statistics
```

**Query Parameters:**
- `period` (optional): Time period (day, week, month, year)

**Response:**
```json
{
  "merchants": {
    "total": 150,
    "active": 142,
    "pending": 5,
    "suspended": 3,
    "newThisPeriod": 12
  },
  "contracts": {
    "total": 4200,
    "active": 3800,
    "completed": 350,
    "cancelled": 50,
    "newThisPeriod": 85
  },
  "financials": {
    "totalFinanced": 21000000,
    "outstandingBalance": 18500000,
    "averageContractValue": 5000,
    "averageInterestRate": 0.0525
  },
  "period": "month"
}
```

## Notification API

### Get Notifications

```
GET /api/notifications
```

**Query Parameters:**
- `unreadOnly` (optional): Get only unread notifications (true/false)
- `page` (optional): Page number for pagination
- `limit` (optional): Number of items per page

**Response:**
```json
{
  "notifications": [
    {
      "id": 345,
      "type": "contract_created",
      "title": "New Contract Created",
      "message": "Contract CON-12345 has been created successfully",
      "read": false,
      "createdAt": "2023-05-15T10:30:00Z",
      "metadata": {
        "contractId": 456,
        "contractNumber": "CON-12345"
      }
    }
  ],
  "unreadCount": 3,
  "pagination": {
    "total": 25,
    "pages": 3,
    "currentPage": 1,
    "limit": 10
  }
}
```

### Mark Notification as Read

```
PUT /api/notifications/:notificationId/read
```

**Response:**
```json
{
  "success": true,
  "notification": {
    "id": 345,
    "read": true
  }
}
```

### Mark All Notifications as Read

```
PUT /api/notifications/read-all
```

**Response:**
```json
{
  "success": true,
  "count": 3
}
```

### Get Unread Count

```
GET /api/notifications/unread-count
```

**Response:**
```json
{
  "count": 3
}
```

## Communications API

### Get Conversations

```
GET /api/communications/conversations
```

**Response:**
```json
{
  "conversations": [
    {
      "id": 567,
      "participantId": 789,
      "participantName": "Customer Name",
      "participantType": "customer",
      "lastMessage": "When is my next payment due?",
      "lastMessageTime": "2023-05-16T14:25:00Z",
      "unreadCount": 1
    }
  ]
}
```

### Get Conversation Messages

```
GET /api/communications/conversations/:conversationId/messages
```

**Response:**
```json
{
  "conversationId": 567,
  "participantId": 789,
  "participantName": "Customer Name",
  "participantType": "customer",
  "messages": [
    {
      "id": 901,
      "senderId": 789,
      "senderType": "customer",
      "content": "When is my next payment due?",
      "timestamp": "2023-05-16T14:25:00Z",
      "read": false
    }
  ]
}
```

### Send Message

```
POST /api/communications/conversations/:conversationId/messages
```

**Request Body:**
```json
{
  "content": "Your next payment is due on June 15th, 2023."
}
```

**Response:**
```json
{
  "success": true,
  "message": {
    "id": 902,
    "senderId": 123,
    "senderType": "merchant",
    "content": "Your next payment is due on June 15th, 2023.",
    "timestamp": "2023-05-16T14:30:00Z",
    "read": false
  }
}
```

## Financial Sherpa API

### Initialize Conversation

```
POST /api/financial-sherpa/init
```

**Request Body:**
```json
{
  "contractId": 456 // Optional, to provide contract context
}
```

**Response:**
```json
{
  "sessionId": "session-1234567890abcdef",
  "clientSecret": "client-secret-1234567890abcdef",
  "websocketUrl": "wss://api.openai.com/v1/audio/speech/realtime/session-1234567890abcdef"
}
```

## CFPB API

### Get Complaint Trends

```
GET /api/cfpb/complaint-trends
```

**Query Parameters:**
- `product` (optional): Filter by product (e.g., "credit_card", "mortgage")
- `dateRange` (optional): Date range in format "YYYY-MM-DD,YYYY-MM-DD"
- `aggregate` (optional): Aggregation field (e.g., "product", "company", "state")

**Response:**
```json
{
  "trends": [
    {
      "date": "2023-01",
      "count": 1254,
      "product": "credit_card",
      "percentChange": 5.2
    },
    {
      "date": "2023-02",
      "count": 1312,
      "product": "credit_card",
      "percentChange": 4.6
    }
  ],
  "summary": {
    "totalComplaints": 7890,
    "topProducts": [
      {
        "product": "credit_card",
        "count": 2566
      },
      {
        "product": "mortgage",
        "count": 1822
      }
    ],
    "periodChange": 3.5
  }
}
```

## Error Responses

All API endpoints use a consistent error response format:

```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND", 
    "message": "The requested resource was not found",
    "details": {} // Optional additional error details
  }
}
```

### Common Error Codes

- `INVALID_INPUT`: Request validation failed
- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Insufficient permissions
- `RESOURCE_NOT_FOUND`: Requested resource not found
- `CONFLICT`: Resource conflict
- `SERVER_ERROR`: Internal server error
- `SERVICE_UNAVAILABLE`: External service unavailable
- `INVALID_CSRF_TOKEN`: Invalid or missing CSRF token