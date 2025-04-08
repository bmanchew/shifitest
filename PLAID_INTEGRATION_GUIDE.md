# Plaid Integration Guide for Asset Reports

This guide explains how to properly integrate with Plaid to obtain valid access tokens and generate asset reports for merchants.

## Understanding Plaid Access Tokens

Plaid access tokens are required for interacting with a user's financial data. They can only be obtained through the proper Plaid Link flow:

1. **Access tokens cannot be constructed or manufactured** - They must be obtained through the Plaid API
2. **Access tokens must be obtained via Plaid Link** - This secure flow protects user credentials
3. **Access tokens have a specific format** - `access-<environment>-<identifier>`

## Correct Flow to Generate Asset Reports

### Step 1: Obtain a Valid Access Token

1. **Create Link Token**: Your backend calls Plaid's `/link/token/create` endpoint
2. **Launch Plaid Link**: Your frontend initializes Plaid Link with the link token
3. **User Connects Accounts**: The user connects their bank accounts via Plaid Link
4. **Get Public Token**: After successful connection, Plaid Link provides a public token
5. **Exchange Public Token**: Your backend exchanges the public token for an access token
6. **Store Access Token**: Your backend securely stores the access token in your database

### Step 2: Generate Asset Reports

1. **Create Asset Report**: Use the stored access token with Plaid's `/asset_report/create` endpoint
2. **Check Report Status**: Reports are generated asynchronously, use `/asset_report/get` to check status
3. **Retrieve Report**: Once ready, retrieve the full report with details of the user's assets

## Implementation Examples

This repository contains the following examples:

1. **plaid-link-flow.cjs**: Backend implementation for Plaid Link integration
2. **plaid-link-demo.html**: Frontend demonstration of Plaid Link flow
3. **generate-merchant-asset-report.cjs**: Script to generate asset reports with valid tokens
4. **check-asset-reports.js**: Script to check the status of pending asset reports

## Common Issues

### Invalid Access Token

If you see this error:
```
"error_code": "INVALID_ACCESS_TOKEN",
"error_message": "provided access token is in an invalid format"
```

This means the access token is not valid. Ensure you:
1. Obtain the token through the proper Plaid Link flow
2. Store the exact token provided by Plaid
3. Do not attempt to construct or modify access tokens manually

### Invalid API Keys

If you see this error:
```
"error_code": "INVALID_API_KEYS",
"error_message": "invalid client_id or secret provided"
```

This means:
1. Your Plaid API credentials (client_id and secret) are incorrect
2. Your credentials don't match the environment of the access token
3. Your credentials don't have permission for the operation

## Strategic Enterprises Inc. Implementation

For Strategic Enterprises Inc. (merchant ID 46), you need to:

1. Use the Plaid Link flow to obtain a valid access token
2. Properly store this token in your plaid_merchants table
3. Use this token for generating asset reports

The current data in your database shows:
- Merchant ID: 46
- Client ID: 64ff00173bc87600133e3876
- Access Token: Not valid (needs to be obtained via Plaid Link)

## Next Steps

1. **Implement Plaid Link**: Use the provided examples to implement the full Plaid Link flow
2. **Update Merchant Database**: Store proper access tokens for each merchant
3. **Generate Asset Reports**: Use the valid access tokens to create asset reports

## Resources

- [Plaid API Documentation](https://plaid.com/docs/api/)
- [Plaid Link Documentation](https://plaid.com/docs/link/)
- [Asset Report Documentation](https://plaid.com/docs/api/products/assets/)
