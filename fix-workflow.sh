#!/bin/bash

# Kill all Node.js processes 
echo "Killing all Node.js processes to free ports..."
pkill -f node || true

# Wait a moment
sleep 2

# Start the server in background with special port assignment
echo "Starting server on port 5001..."
PORT=5001 npm run dev &

# Wait for server to start
sleep 5

# Start port forwarder in background
echo "Starting port forwarder from 5000 to 5001..."
node improved-port-forwarder.js &

echo "Server should be accessible on both ports 5000 and 5001"