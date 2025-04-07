# Shiloh Finance Platform

A cutting-edge fintech platform delivering intelligent merchant financing solutions through advanced AI-driven analytics and comprehensive communication technologies.

## Core Technologies

- TypeScript full-stack application with modular route architecture
- React with Vite for dynamic frontend rendering
- PostgreSQL database with enterprise-grade security protocols
- Advanced OpenAI-powered financial insights generation
- Comprehensive merchant authentication and contract management system
- Enhanced security middleware with JWT authentication
- Plaid and MidDesk integrations for comprehensive financial data
- Robust conversation and ticket management infrastructure

## Features

### Merchant Management

- Onboarding and authentication
- Profile management
- Financial data integration via Plaid
- Contract management
- Dashboard with financial insights

### Admin Portal

- Merchant oversight
- Contract approval and management
- Funding controls
- Due diligence reporting

### Financial Analysis

- OpenAI-powered financial health assessment
- Real-time AI conversations for merchant support
- Custom audio responses for accessibility

### Plaid Integration

- Account connection and management
- Transaction history access
- Balance monitoring
- Asset report generation

## Utilities

### Asset Reports

The platform includes utilities for generating and managing Plaid asset reports:

- `asset_reports/check-asset-reports.ts` - Checks the status of all asset reports
- `asset_reports/generate-asset-reports.ts` - Generates new asset reports for all merchants
- `asset_reports/schedule-asset-reports.ts` - Schedules regular asset report generation
- `asset_reports/example-usage.ts` - Example workflow for asset report management

For more information, see the [Asset Reports README](asset_reports/README.md).

#### Quick Start

Use the utility script to interact with asset reports:

```bash
# Make the utility script executable
chmod +x asset-reports-util.sh

# Display help
./asset-reports-util.sh help

# Check current asset report status
./asset-reports-util.sh check

# Generate new asset reports
./asset-reports-util.sh generate

# Run the scheduled asset report generator
./asset-reports-util.sh schedule

# Run the example workflow
./asset-reports-util.sh example
```

## Development

### Setup

1. Clone the repository
2. Set up environment variables in .env
3. Start the development server

### Environment Variables

Core environment variables required:

```
DATABASE_URL=postgresql://...
JWT_SECRET=...
PUBLIC_URL=...
```

For Plaid integration:

```
PLAID_CLIENT_ID=...
PLAID_SECRET=...
PLAID_ENVIRONMENT=development
```

For OpenAI integration:

```
OPENAI_API_KEY=...
```

## License

Proprietary - All rights reserved
