# Workflow Documentation

This document provides information about the workflows, scripts, and development processes used in the ShiFi financial platform application.

## Development Workflow

### Starting the Application

The application can be started using the following command:

```bash
npm run dev
```

This command runs the development server for both the frontend and backend:
- React frontend via Vite
- Express backend with TypeScript

If you encounter port conflicts, the following scripts are available to help:

- `node free-port.js`: Attempts to free up port 5000 if it's in use
- `node start-server.js`: Tries to start the server, falling back to an alternate port if needed
- `node start-with-port-forward.js`: Starts the server on port 5001 and sets up a forwarding proxy on port 5000

### Port Conflict Resolution

The application is configured to listen on port 5000 by default. However, sometimes this port may be in use by another process. The application includes a port conflict resolution system that:

1. First attempts to use port 5000
2. If port 5000 is unavailable, it falls back to port 5001
3. When using port 5001, it may set up a port forwarding mechanism so the application can still be accessed on port 5000

If you're experiencing port conflicts, you can manually resolve them using:

```bash
node free-port.js
```

This script will detect and terminate processes using port 5000.

### Database Operations

#### Push Schema Changes

To update the database schema after making changes to the models:

```bash
npm run db:push
```

This uses Drizzle Kit to push schema changes to the database.

#### Migrations

The application handles database migrations automatically during startup. The migration system:

1. Checks for required schema changes
2. Applies migrations in order
3. Logs the migration process

Custom migrations are located in the `migrations/` directory.

## Testing

### Running Tests

The application includes various test scripts for different components:

```bash
# Test API endpoints
node test-api.js

# Test the contract cancellation workflow
node test-cancellation-workflow.js

# Test Twilio SMS integration
node test-twilio-sms.js

# Test email services
node test-email-service.js
```

### Creating Test Data

To set up test data for development:

```bash
node setup-test-merchant.js
```

This script creates a test merchant account with sample data.

## Deployment Process

### Build Process

To build the application for production:

```bash
npm run build
```

This command:
1. Builds the React frontend using Vite
2. Compiles TypeScript backend code
3. Optimizes assets for production

### Production Server

To start the production server:

```bash
npm start
```

## Troubleshooting

### Server Won't Start

If the server won't start due to port conflicts:

1. Check if port 5000 is in use: `lsof -i :5000`
2. Try freeing the port: `node free-port.js`
3. Use the alternate startup script: `node start-with-port-forward.js`

### Database Connection Issues

If you experience database connection issues:

1. Verify the database is running
2. Check the `.env` file for correct DATABASE_URL
3. Run the database status check: `node check-database-status.js`

### OpenAI Integration Issues

The Financial Sherpa component uses OpenAI's Realtime API, which requires specific permissions:

1. Ensure you have a valid OpenAI API key with Realtime API access
2. Check API key permissions using: `node test-openai-realtime-access.js`
3. Test the direct connection using: `node test-openai-realtime-directly.js`

If the OpenAI API key lacks the necessary permissions, the Financial Sherpa component will be hidden from the UI.

## Common Scripts

### Development Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run check` | Run TypeScript type checking |
| `npm run db:push` | Push schema changes to database |

### Utility Scripts

| Script | Description |
|--------|-------------|
| `node free-port.js` | Free up port 5000 |
| `node start-server.js` | Start server with port fallback |
| `node setup-test-merchant.js` | Create test merchant data |
| `node test-api.js` | Test API endpoints |
| `node test-cancellation-workflow.js` | Test contract cancellation workflow |

### Restart Scripts

| Script | Description |
|--------|-------------|
| `node restart-workflow.js` | Restart the workflow safely |
| `node restart-safe.js` | Restart with safe handling of ports |
| `node restart-port-forwarding.js` | Restart with port forwarding enabled |

## Environment Variables

The application uses several environment variables for configuration:

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL database connection string | Yes |
| `SESSION_SECRET` | Secret for session encryption | Yes |
| `NODE_ENV` | Environment (development, production) | Yes |
| `OPENAI_API_KEY` | OpenAI API key for AI features | Optional |
| `TWILIO_ACCOUNT_SID` | Twilio account SID for SMS | Optional |
| `TWILIO_AUTH_TOKEN` | Twilio authentication token | Optional |
| `TWILIO_PHONE_NUMBER` | Twilio phone number for sending SMS | Optional |
| `SENDGRID_API_KEY` | SendGrid API key for email | Optional |
| `PLAID_CLIENT_ID` | Plaid API client ID | Optional |
| `PLAID_SECRET` | Plaid API secret | Optional |
| `STRIPE_SECRET_KEY` | Stripe API secret key | Optional |
| `BASE_URL` | Application base URL | Optional |

## Workflow Configuration

The application uses a Replit workflow configuration for starting the application. The workflow is defined as:

```json
{
  "name": "Start application",
  "command": "npm run dev"
}
```

This workflow can be restarted using the Replit interface or through the `restart_workflow` tool.