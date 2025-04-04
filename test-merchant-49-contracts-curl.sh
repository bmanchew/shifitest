#!/bin/bash

# Test script to diagnose why contracts for merchant ID 49 are not appearing in the UI dropdown
# This version uses curl for better cookie handling

# Configuration
BASE_URL="http://localhost:5000/api"
COOKIES_FILE="./brandon-cookies.txt"  # Brandon is merchant ID 49

# Merchant credentials (Brandon)
MERCHANT_EMAIL="brandon@shilohfinance.com"
MERCHANT_PASSWORD="Password123!"

# Function to login and save cookies
login_as_merchant() {
  echo "Logging in as merchant..."
  
  # Remove existing cookies file if it exists
  rm -f $COOKIES_FILE
  
  # Login and save cookies
  curl -s -c $COOKIES_FILE -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -H "X-CSRF-Bypass: test-merchant-message-read" \
    -d "{\"email\":\"$MERCHANT_EMAIL\",\"password\":\"$MERCHANT_PASSWORD\"}"
  
  echo -e "\nCookies saved to $COOKIES_FILE"
}

# Function to test the contracts API endpoint directly
test_contracts_api_direct() {
  echo -e "\nTesting GET /api/contracts?merchantId=49 endpoint directly..."
  
  # Make API call
  local response=$(curl -s -b $COOKIES_FILE "$BASE_URL/contracts?merchantId=49")
  
  echo "API Response:"
  echo "$response" | jq '.'
  
  # Check what type of response we got
  if [[ $(echo "$response" | jq 'if type=="array" then true else false end') == "true" ]]; then
    count=$(echo "$response" | jq 'length')
    echo "Found $count contracts in array response"
  elif [[ $(echo "$response" | jq 'if has("contracts") then true else false end') == "true" ]]; then
    count=$(echo "$response" | jq '.contracts | length')
    echo "Found $count contracts in 'contracts' property"
  else
    echo "Unexpected response format - no contracts array found"
  fi
}

# Function to test the merchant endpoint for contracts
test_merchant_contracts_api() {
  echo -e "\nTesting GET /api/merchant/49/contracts endpoint..."
  
  # Make API call
  local response=$(curl -s -b $COOKIES_FILE "$BASE_URL/merchant/49/contracts")
  
  echo "API Response:"
  echo "$response" | jq '.'
  
  # Check the number of contracts returned
  if [[ $(echo "$response" | jq 'if type=="array" then true else false end') == "true" ]]; then
    count=$(echo "$response" | jq 'length')
    echo "Found $count contracts from merchant endpoint"
  else
    echo "Unexpected response format - not an array"
  fi
}

# Function to check frontend contract request
test_frontend_contract_request() {
  echo -e "\nSimulating frontend request to GET /api/contracts?merchantId=49..."
  
  # Make API call as it would be made from the frontend
  local response=$(curl -s -b $COOKIES_FILE -H "Origin: http://localhost:5000" -H "Referer: http://localhost:5000/" "$BASE_URL/contracts?merchantId=49")
  
  echo "Frontend API Response:"
  echo "$response" | jq '.'
}

# Main test function
run_test() {
  # Login first
  login_as_merchant
  
  # Test contracts API endpoint directly
  test_contracts_api_direct
  
  # Test merchant endpoint for contracts
  test_merchant_contracts_api
  
  # Test frontend-style request
  test_frontend_contract_request
}

# Run the test
run_test