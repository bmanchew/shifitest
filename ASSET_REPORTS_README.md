# Plaid Asset Report Generation System

This document provides instructions for using the automated asset report generation system for merchants with completed Plaid integrations.

## Overview

The system consists of three main components:

1. **Asset Report Generator** - Creates asset reports for all merchants with completed Plaid onboarding status
2. **Asset Report Checker** - Checks the status of pending asset reports and updates the database
3. **Scheduler** - Sets up scheduled tasks to run the generator and checker automatically

## Prerequisites

To use this system, you need:

1. Plaid API credentials:
   - `PLAID_CLIENT_ID` - Platform client ID for Plaid API
   - `PLAID_SECRET` - Platform secret for Plaid API
   - `PLAID_MERCHANT_SECRET` - Secret for merchant-specific client IDs

2. For each merchant:
   - Valid Plaid access token in the proper format: `access-<environment>-<identifier>`
   - Onboarding status set to "completed" in the plaid_merchants table

## Scripts

### 1. Generate Asset Reports

The script `generate-asset-reports-for-completed-merchants.cjs` creates asset reports for all eligible merchants.

```bash
node generate-asset-reports-for-completed-merchants.cjs
```

This script:
- Retrieves all merchants with completed Plaid onboarding
- Creates an asset report for each merchant
- Stores the report details in the asset_reports table
- Validates access token formats and skips invalid ones

### 2. Check Asset Reports

The script `check-asset-reports.js` checks the status of pending asset reports.

```bash
node check-asset-reports.js
```

This script:
- Retrieves all pending asset reports from the database
- Queries Plaid API to check the status of each report
- Updates the database with the current status and asset data
- Handles errors and updates report status accordingly

### 3. Schedule Asset Reports

There are two approaches to scheduling:

#### A. Using the JavaScript Scheduler

The script `schedule-asset-reports.cjs` sets up a schedule using node-cron:

```bash
node schedule-asset-reports.cjs
```

This creates:
- Daily asset report generation (1:00 AM by default)
- Asset report status checks every 4 hours
- Log files in the logs/ directory

#### B. Using System Cron (Recommended for Production)

For a more robust solution, use the shell script to set up system cron jobs:

```bash
sudo bash setup-asset-report-schedule.sh
```

This creates:
- Daily asset report generation (1:00 AM)
- Asset report status checks every 6 hours
- Log files in the logs/ directory

## Database Tables

The system uses the following database tables:

1. `merchants` - Basic merchant information
2. `plaid_merchants` - Merchant-specific Plaid settings including:
   - `merchant_id` - Reference to merchants table
   - `access_token` - Plaid access token
   - `client_id` - Merchant-specific Plaid client ID (if applicable)
   - `onboarding_status` - Status of Plaid onboarding process

3. `asset_reports` - Generated asset reports with:
   - `user_id` - References merchant_id
   - `asset_report_id` - Plaid's asset report ID
   - `asset_report_token` - Token for retrieving the report
   - `status` - Current status (pending/ready/error)
   - `analysis_data` - JSON data with account balances and details

## Environment Variables

The system uses these environment variables:

- `PLAID_CLIENT_ID` - Platform client ID for Plaid API
- `PLAID_SECRET` - Platform secret for Plaid API
- `PLAID_MERCHANT_SECRET` - Secret for merchant-specific client IDs
- `PLAID_ENVIRONMENT` - Plaid environment (sandbox/development/production)
- `PLAID_WEBHOOK_URL` - Webhook URL for asset report notifications
- `ASSET_REPORT_GENERATE_SCHEDULE` - Cron schedule for generation (optional)
- `ASSET_REPORT_CHECK_SCHEDULE` - Cron schedule for status checks (optional)

## Troubleshooting

### Access Token Format Issues

Plaid access tokens must follow the format: `access-<environment>-<identifier>`

For sandbox testing: `access-sandbox-<identifier>`
For production: `access-production-<identifier>`

### API Authentication Errors

If you receive "INVALID_API_KEYS" errors:
1. Verify the client ID and secret match the environment of the access token
2. For merchant-specific client IDs, ensure `PLAID_MERCHANT_SECRET` is set correctly
3. Confirm the access token is valid and has not expired

### Missing Asset Reports

If reports aren't being generated:
1. Check that merchants have "completed" onboarding status
2. Verify access tokens are in the proper format
3. Check environment compatibility (sandbox tokens with sandbox environment)

### Debugging

For detailed debugging:
1. Check logs in the logs/ directory
2. Run scripts with direct Node.js execution to see output
3. Check the database for error details in the analysis_data field

## Support

For issues with the asset report system, please contact the development team.

## Maintenance

Regularly check the logs directory to ensure scripts are running properly and clean up old log files as needed.
