# Plaid Transfers Implementation Guide

This document outlines the implementation of Plaid Transfers in the ShiFi platform, which enables merchants to initiate ACH transfers using both merchant-specific Plaid credentials and ShiFi's platform credentials.

## Overview

The Plaid Transfer service is designed to work with two credential modes:

1. **Platform Credentials**: Using ShiFi's Plaid API keys
2. **Merchant-Specific Credentials**: Using a merchant's own Plaid API keys when available

The implementation follows Plaid's documentation for payment transfers: https://plaid.com/docs/api/products/transfer/

## Core Components

### 1. Plaid Transfer Service (`server/services/plaid-transfer.js`)

This service handles all interactions with the Plaid API for transfers:

- Creating transfer authorizations
- Creating transfers
- Getting transfer information
- Listing transfers for a merchant
- Cancelling transfers
- Creating payment recipients
- Creating funding accounts

### 2. API Routes (`server/routes/api/plaid-transfers.js`)

These routes expose the transfer functionality through the application's API:

- `GET /api/plaid-transfers/merchant/:merchantId` - List transfers for a merchant
- `GET /api/plaid-transfers/:transferId` - Get details for a specific transfer
- `POST /api/plaid-transfers/authorization` - Create a transfer authorization
- `POST /api/plaid-transfers` - Create a transfer
- `POST /api/plaid-transfers/cancel` - Cancel a transfer

### 3. Example Scripts

- `examples/plaid-transfer-demo.cjs` - Demonstrates the transfer process
- `examples/validate-plaid-credentials.cjs` - Validates merchant credentials for transfers

## Transfer Process

1. **Obtain Valid Access Token**

   Before a merchant can use transfers, they must have a valid Plaid access token obtained through the Plaid Link flow.

2. **Create Transfer Authorization**

   ```javascript
   const authorization = await createTransferAuthorization(
     merchantId,
     accountId,
     'credit', // or 'debit'
     amount,
     description
   );
   ```

3. **Create Transfer**

   ```javascript
   const transfer = await createTransfer(
     merchantId,
     authorization.authorization_id,
     description,
     { /* optional metadata */ }
   );
   ```

4. **Monitor Transfer Status**

   ```javascript
   const transferDetails = await getTransfer(merchantId, transferId);
   ```

## Required Merchant Information

For a merchant to use transfers, the following information is required:

- `merchant_id` - The merchant's ID in the system
- `client_id` - The merchant's Plaid client ID (optional, uses platform credentials if not provided)
- `access_token` - A valid Plaid access token (required)
- `account_id` - The ID of the merchant's bank account for transfers (required)

## Credential Selection Logic

The service automatically selects the appropriate credentials:

```javascript
// If the merchant has specific credentials, use those
if (plaidMerchant.client_id) {
  clientId = plaidMerchant.client_id;
  secret = process.env.PLAID_MERCHANT_SECRET;
} else {
  // Otherwise, use ShiFi's platform credentials
  clientId = process.env.PLAID_CLIENT_ID;
  secret = process.env.PLAID_SECRET;
}
```

## Environment Configuration

The following environment variables are required:

- `PLAID_CLIENT_ID` - ShiFi's platform Plaid client ID
- `PLAID_SECRET` - ShiFi's platform Plaid secret
- `PLAID_MERCHANT_SECRET` - Secret for merchant-specific credentials
- `PLAID_ENVIRONMENT` - The Plaid environment to use (sandbox, development, production)

## Testing

Before implementing transfers in production, it's recommended to:

1. Run the `validate-plaid-credentials.cjs` script to verify merchant credentials
2. Test transfers in the Plaid sandbox environment
3. Follow Plaid's documentation for transitioning to the production environment
