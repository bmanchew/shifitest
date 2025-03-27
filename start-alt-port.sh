#!/bin/bash

# This script starts the server on an alternate port to avoid port conflicts

# Kill any existing processes on port 5000 first
echo "Killing any processes on port 5000..."
for pid in $(pgrep -f "node|tsx"); do
  if [ "$pid" != "$$" ]; then
    echo "Killing process $pid"
    kill -9 $pid 2>/dev/null || echo "Failed to kill process $pid"
  fi
done

# Set an alternate port for the server
export PORT=5001

# Start the server with the alternate port
echo "Starting server on port $PORT..."
npx tsx server/index.ts