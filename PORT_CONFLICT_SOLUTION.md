# Port Conflict Resolution Solution

This document explains the solution for handling port conflicts in the ShiFi application.

## Problem

The application was experiencing startup failures due to port conflicts, where port 5000 was sometimes already in use when trying to start the server. This would cause the workflow to fail and prevent the application from running.

## Solution

We implemented a comprehensive solution to handle port conflicts:

1. **Port Availability Checking**: Created a mechanism to check if the default port (5000) is available before starting the server.

2. **Port Fallback Logic**: Implemented fallback logic to use an alternate port (5001) when the default port is unavailable.

3. **Process Management**: Added functionality to safely terminate any conflicting processes that might be using the required ports.

4. **Safe Startup Scripts**: Created the following scripts to ensure reliable application startup:

   - `start-server.js`: An enhanced server startup script that includes port conflict detection and alternate port selection.
   - `free-port.js`: A utility script that attempts to free up port 5000 by terminating any processes using it.
   - `start-alt-port.sh`: A shell script that explicitly sets an alternate port (5001) for the server.
   - `restart-safe.js`: A utility script that restarts the application with the safe port handling.

## How to Use

### Option 1: Use the restart-safe.js script

This is the recommended method for ensuring the server starts reliably:

```bash
node restart-safe.js
```

This script will:
1. Stop any running server processes
2. Start the server using the `start-server.js` script, which includes port conflict handling

### Option 2: Direct use of start-server.js

You can also directly use the start-server.js script:

```bash
node start-server.js
```

This script will:
1. Check if port 5000 is available
2. Use port 5000 if available
3. Fall back to port 5001 if port 5000 is unavailable

### Option 3: Explicitly use an alternate port

If you know port 5000 is unavailable, you can explicitly use the alternate port:

```bash
./start-alt-port.sh
```

## Implementation Details

### Server Configuration

The server's port configuration in `server/index.ts` has been verified to respect the PORT environment variable:

```typescript
// Production deployment must use port 5000 consistently for Cloud Run
const isProd = process.env.NODE_ENV === 'production';
const basePort = isProd ? 5000 : (process.env.PORT ? parseInt(process.env.PORT, 10) : 5000);
```

This allows our scripts to override the port by setting the PORT environment variable.

### Port Checking Logic

The `isPortAvailable` function in `start-server.js` uses Node.js's net module to test if a port is available:

```javascript
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', () => {
      resolve(false);
    });
    
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    
    server.listen(port);
  });
}
```

## Conclusion

This solution ensures that the application can start reliably even when port conflicts occur, improving the stability and reliability of the development environment.