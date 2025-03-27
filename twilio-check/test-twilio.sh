#!/bin/bash

# Test script for Twilio SMS functionality

echo "🚀 ShiFi Twilio SMS Test Suite 🚀"
echo "================================="
echo

# Check if simple-twilio-server.js is already running
SERVER_PID=$(ps aux | grep "node simple-twilio-server.js" | grep -v grep | awk '{print $2}')

if [ -z "$SERVER_PID" ]; then
  echo "✨ Starting Twilio test server..."
  node ../simple-twilio-server.js &
  SERVER_PID=$!
  echo "✅ Server started with PID $SERVER_PID"
  
  # Give the server time to start
  echo "⏳ Waiting for server to initialize..."
  sleep 2
else
  echo "✅ Twilio test server already running with PID $SERVER_PID"
fi

echo
echo "🔍 Running API tests..."
node test-sms-api.js

TEST_RESULT=$?

echo
echo "🧹 Cleaning up..."

# Only kill the server if we started it
if [ -n "$SERVER_PID" ]; then
  echo "🛑 Stopping Twilio test server (PID $SERVER_PID)..."
  kill $SERVER_PID
  echo "✅ Server stopped"
fi

echo
if [ $TEST_RESULT -eq 0 ]; then
  echo "🎉 All tests completed successfully!"
else
  echo "❌ Tests failed with exit code $TEST_RESULT"
fi

exit $TEST_RESULT