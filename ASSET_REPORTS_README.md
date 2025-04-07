# Plaid Asset Report Generator

This document provides information about the Plaid asset report generator scripts.

## Overview

These scripts allow you to:

1. Generate asset reports for all merchants with completed Plaid integrations
2. Check the status of asset reports for all merchants

## Prerequisites

- Plaid API keys must be configured in your environment variables
- Merchants must have completed Plaid integrations with valid access tokens

## Scripts

### 1. Generate Asset Reports

The `generate-asset-reports.js` script creates a new asset report for each merchant with a completed Plaid integration.

```bash
node generate-asset-reports.js
```

This script:
- Fetches all merchants with 'completed' Plaid onboarding status
- Creates an asset report for each merchant using their Plaid access token
- Stores the asset report token in the database
- Provides a summary of successful and failed report generations

### 2. Check Asset Report Status

The `check-asset-reports.js` script checks the status of all asset reports for merchants with completed Plaid integrations.

```bash
node check-asset-reports.js
```

This script:
- Fetches all merchants with 'completed' Plaid onboarding status
- Retrieves all asset reports associated with these merchants
- Groups reports by status (pending, ready, error)
- Provides a summary of the report statuses

## Important Notes

- Asset reports are created asynchronously by Plaid
- Webhooks will be received when asset reports are ready for viewing
- The webhook endpoint must be properly configured in the environment
- Reports may take a few minutes to generate depending on the amount of data

## Viewing Asset Reports

Asset reports are accessible through the admin interface under the merchant's profile page.

## Troubleshooting

If you encounter any issues:

1. Check that your Plaid API keys are correctly configured
2. Verify that the merchant has a valid Plaid access token
3. Check for webhook errors in the logs
4. Ensure the webhook URL is properly configured and accessible from the internet
