# Plaid Asset Reports Utility

This directory contains utility scripts for managing Plaid asset reports for merchants with completed Plaid integrations.

## Overview

The asset reports functionality allows the system to generate comprehensive financial reports for merchants using their connected Plaid accounts. These reports contain detailed information about account balances, transactions, and other financial data that can be used for underwriting decisions.

## Scripts

### 1. Check Asset Reports Status

The `check-asset-reports.ts` script checks the status of all recently generated asset reports for merchants with Plaid integrations.

```bash
npx tsx check-asset-reports.ts
```

This script will:
- Find all merchants with completed Plaid integrations
- Retrieve all asset reports for these merchants
- Group and display reports by status (pending, ready, error)
- Show detailed information about each report

### 2. Generate Asset Reports

The `generate-asset-reports.ts` script creates new Plaid asset reports for all merchants with completed Plaid integrations.

```bash
npx tsx generate-asset-reports.ts
```

This script will:
- Find all merchants with completed Plaid integrations
- Create an asset report for each merchant with a valid access token
- Store the asset report tokens in the database
- Display a summary of successful and failed report generations

### 3. Example Usage

The `example-usage.ts` script demonstrates how to use both utilities together in a workflow.

```bash
npx tsx example-usage.ts
```

This script will:
1. Check current asset report status
2. Generate new asset reports
3. Check updated status after generation

### 4. Schedule Asset Reports

The `schedule-asset-reports.ts` script is designed to be run on a regular schedule (e.g., weekly) to automatically generate new asset reports.

```bash
npx tsx schedule-asset-reports.ts
```

## Asset Report Workflow

1. **Generation**: Asset reports are generated asynchronously by calling the Plaid API.
2. **Processing**: Plaid processes the report request in the background.
3. **Webhooks**: When a report is ready, Plaid sends a webhook notification to the system.
4. **Status Update**: The system updates the report status to "ready" in the database.
5. **Retrieval**: The report can then be accessed and downloaded using the stored asset report token.

## Implementation Details

- Asset reports are configured to include 90 days of financial data by default.
- Each report includes a webhook URL for notification when the report is ready.
- Reports can be in one of three states: "pending", "ready", or "error".
- The system stores all asset report tokens and IDs in the database.

## Common Issues

- **No Access Token**: If a merchant shows "No access token available", they may need to re-authenticate with Plaid or complete their onboarding process.
- **Pending Reports**: Reports may stay in "pending" status for several minutes while Plaid processes them.
- **Error Reports**: If a report has an error status, check the error message for troubleshooting.

## Requirements

- Plaid API credentials (set as environment variables)
- PostgreSQL database
- Node.js with TypeScript support

## Environment Variables

The scripts require the following environment variables to be set:

- `PLAID_CLIENT_ID`: Your Plaid client ID
- `PLAID_SECRET`: Your Plaid secret key
- `PLAID_ENVIRONMENT`: The Plaid environment to use (e.g., "sandbox", "development", "production")
- `PUBLIC_URL`: The base URL of your application (used for webhooks)
