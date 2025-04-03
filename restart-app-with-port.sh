#!/bin/bash

# Kill any node processes that might be holding ports
echo "Killing existing Node.js processes..."
pkill -f node || echo "No Node processes to kill"

# Wait a moment for processes to terminate
sleep 2

# Set a different port for the WebSocket server in the environment
export WS_PORT=5001

# Start the application
echo "Starting application with custom port..."
npm run dev