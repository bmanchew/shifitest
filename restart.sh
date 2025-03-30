#!/bin/bash

# This script restarts the application with port forwarding
# It ensures that the main server runs on port 5001 and a forwarder runs on port 5000

echo "Restarting application with port forwarding..."

# Kill any existing Node.js processes
echo "Stopping any running Node.js processes..."
pkill -f "node" || true
pkill -f "tsx" || true

# Wait a moment for processes to terminate
sleep 2

# Start the application using our custom script
echo "Starting application with port forwarding..."
node start-workflow-fixed.js