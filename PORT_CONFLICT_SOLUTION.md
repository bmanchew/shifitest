# Port Conflict Resolution Documentation

This document explains the port conflict resolution strategy implemented in the ShiFi application.

## Problem

The application was experiencing port conflicts when trying to start on port 5000, which is a commonly used port that might be occupied by other services. This caused the server to fail to start in some environments.

## Solution Overview

We've implemented a multi-faceted port conflict resolution strategy:

1. **Process Termination**: Automatically terminate any existing Node.js processes that might be using the ports 
2. **Port Forwarding**: When port 5000 is unavailable, use port 5001 for the actual server and set up a port forwarder on port 5000
3. **Port Checking**: Validate port availability before starting the services
4. **Graceful Fallback**: Allow the server to automatically try alternative ports

## Implementation Details

### Key Scripts

1. **start-workflow-fixed.js**
   - Main script for starting the server with port forwarding
   - Runs the actual server on port 5001
   - Creates a HTTP proxy on port 5000 that redirects to port 5001
   - Kills any existing Node.js processes that might conflict

2. **free-port.js**
   - Standalone script to free up port 5000
   - Identifies and terminates processes using the port
   - Compatible with Linux, Mac, and Windows environments

3. **restart-workflow.js**
   - Safely restarts the workflow
   - Terminates existing processes
   - Starts the server with our port forwarding solution

4. **restart-port-forwarding.js**
   - Standalone port forwarding utility
   - Can be run independently to forward requests from port 5000 to 5001
   - Includes health checking of the destination server
   - Useful when the server is already running on port 5001 but needs to be accessible on port 5000

5. **start-with-port-forward.js**
   - Enhanced version that intelligently adapts to current port status
   - Checks if servers are already running on ports 5000 or 5001
   - Can start just the port forwarder if server is already running
   - Implements multiple fallback strategies based on port availability

### How Port Forwarding Works

The port forwarding mechanism works by:

1. The main Express application runs on port 5001
2. A simple HTTP server runs on port 5000 
3. When requests come to port 5000, they are redirected to port 5001
4. This allows external services that expect the server on port 5000 to work properly

Example (from start-workflow-fixed.js):
```javascript
const forwarder = createHttpServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta http-equiv="refresh" content="0;url=http://${req.headers.host.replace('5000', '5001')}${req.url}">
        <title>Redirecting...</title>
      </head>
      <body>
        <h1>Redirecting to active server port...</h1>
        <p>If you are not redirected, <a href="http://${req.headers.host.replace('5000', '5001')}${req.url}">click here</a>.</p>
      </body>
    </html>
  `);
});
```

## Usage

### Starting the Server

To start the server with port conflict resolution:

```bash
node start-workflow-fixed.js
```

For the most intelligent port conflict handling:

```bash
node start-with-port-forward.js
```

### Restarting the Workflow

To restart the workflow safely:

```bash
node restart-workflow.js
```

### Manually Freeing Up Port 5000

If you need to manually free up port 5000:

```bash
node free-port.js
```

### Running Just the Port Forwarder

If the server is already running on port 5001 but you need to make it accessible on port 5000:

```bash
node restart-port-forwarding.js
```

## Troubleshooting

If you're still experiencing port conflicts:

1. Check if any other services are using port 5000:
   ```bash
   lsof -i :5000
   ```

2. Ensure that all Node.js processes are properly terminated:
   ```bash
   ps -e | grep node
   ```

3. Try increasing the wait time between process termination and server startup in start-workflow-fixed.js.

## Conclusion

This port conflict resolution strategy ensures that the ShiFi application can start reliably, even in environments where port 5000 might be in use. By implementing process termination and port forwarding, we've created a robust solution that adapts to the environment.