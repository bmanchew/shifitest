# Server Stability Guide

This document outlines the strategies and best practices implemented to ensure the ShiFi server stability, especially in the Replit environment.

## Challenges

Running a production-grade server in cloud development environments presents several challenges:

1. **Port Conflicts**: Common ports (like 5000) might be used by other services
2. **Process Management**: Orphaned processes can prevent server restart
3. **Resource Constraints**: Limited memory and CPU resources
4. **Network Reliability**: Connection interruptions can cause issues
5. **Environment Consistency**: Ensuring consistent behavior across environments

## Stability Solutions

### 1. Port Conflict Resolution

We've implemented a robust port conflict resolution strategy to ensure the server can always start:

- **Process Termination**: Automatically terminate any Node.js processes using the required ports
- **Port Forwarding**: Use a port forwarding mechanism when port 5000 is unavailable
- **Graceful Fallback**: Try alternative ports (5001) when primary port is unavailable
- **Port Checking**: Pre-emptively check for port availability before starting services

For detailed information, see [PORT_CONFLICT_SOLUTION.md](./PORT_CONFLICT_SOLUTION.md).

### 2. Process Management

To prevent orphaned processes and ensure clean restarts:

- **Startup Lock**: Use a startup lock file to prevent multiple concurrent server instances
- **Process Identification**: Identify and terminate orphaned processes
- **Signal Handling**: Properly handle SIGINT and SIGTERM signals
- **Graceful Shutdown**: Implement graceful shutdown procedures for clean termination

### 3. Error Handling and Recovery

Comprehensive error handling ensures the server can recover from failures:

- **Error Categories**: Categorize errors (api, validation, auth, resource, system, payment)
- **Error Boundaries**: Implement error boundaries to contain failures
- **Retry Logic**: Add retry logic for transient failures (database connections, API calls)
- **Circuit Breakers**: Implement circuit breakers for external service calls
- **Fallback Strategies**: Define fallback strategies for critical services

### 4. Resource Optimization

To operate efficiently within resource constraints:

- **Connection Pooling**: Use database connection pooling
- **Memory Management**: Implement careful memory management and garbage collection
- **Request Throttling**: Apply rate limiting to prevent resource exhaustion
- **Caching**: Use appropriate caching strategies
- **Efficient Queries**: Optimize database queries and indexes

### 5. Health Monitoring

Continuous monitoring helps identify and resolve issues:

- **Health Checks**: Implement health check endpoints
- **Logging**: Comprehensive structured logging with severity levels
- **Performance Metrics**: Track key performance metrics
- **Alerting**: Set up alerts for critical issues
- **Audit Trail**: Maintain audit logs for security-related events

## Key Server Stability Scripts

### 1. start-workflow-fixed.js

Main script for starting the server with port conflict resolution:

```bash
node start-workflow-fixed.js
```

### 2. restart-workflow.js

Safely restart the server with proper process cleanup:

```bash
node restart-workflow.js
```

### 3. free-port.js

Manually free up port 5000 if it's in use:

```bash
node free-port.js
```

### 4. restart-port-forwarding.js

Start a standalone port forwarder from port 5000 to port 5001:

```bash
node restart-port-forwarding.js
```

### 5. start-with-port-forward.js

Enhanced intelligent server startup with situational awareness:

```bash
node start-with-port-forward.js
```

## Best Practices for Development

1. **Always use the restart script** instead of manually restarting the server:
   ```bash
   node restart-workflow.js
   ```

2. **Check for port conflicts** if the server fails to start:
   ```bash
   lsof -i :5000
   ```

3. **Review logs** for any stability issues:
   ```bash
   grep "error" logs/server.log
   ```

4. **Verify environment variables** are properly set:
   ```bash
   node -e "console.log(process.env.PORT)"
   ```

5. **Monitor memory usage** for any leaks:
   ```bash
   ps -o pid,rss,command | grep node
   ```

## Conclusion

By implementing these stability strategies, the ShiFi server is robust against common issues that can occur in cloud development environments. The port conflict resolution strategy is particularly effective at ensuring the server can reliably start and remain accessible.