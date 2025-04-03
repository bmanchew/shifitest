#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# User credentials
USER_EMAIL="brandon@shilohfinance.com"
USER_PASSWORD="Password123!"
MERCHANT_ID=49
BASE_URL="http://localhost:5000"

echo -e "${YELLOW}Testing Merchant API with curl${NC}"
echo -e "${YELLOW}------------------------------${NC}"

# Step 1: Login to get session cookie
echo -e "${YELLOW}Logging in as $USER_EMAIL...${NC}"
RESPONSE=$(curl -s -c cookies.txt -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$USER_EMAIL\",\"password\":\"$USER_PASSWORD\"}")

# Check if login was successful
if [[ $RESPONSE == *"\"success\":true"* ]]; then
  echo -e "${GREEN}Login successful!${NC}"
  echo -e "Response: $RESPONSE"
else
  echo -e "${RED}Login failed: $RESPONSE${NC}"
  exit 1
fi

# Step 2: Get merchant contracts
echo -e "${YELLOW}Retrieving contracts for merchant ID $MERCHANT_ID...${NC}"
CONTRACTS=$(curl -s -b cookies.txt "$BASE_URL/api/merchants/$MERCHANT_ID/contracts")

# Check if we got a valid JSON response
if jq -e . >/dev/null 2>&1 <<< "$CONTRACTS"; then
  # Extract number of contracts
  CONTRACT_COUNT=$(echo $CONTRACTS | jq '. | length')
  echo -e "${GREEN}Retrieved $CONTRACT_COUNT contracts${NC}"
  
  # If we have contracts, show the first one
  if [ "$CONTRACT_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}Details of first contract:${NC}"
    echo $CONTRACTS | jq '.[0]' | grep -E "id|contractNumber|amount|termMonths|term|status|merchantId|customerId"
    
    # Extract first contract's customer ID and status for further testing
    CUSTOMER_ID=$(echo $CONTRACTS | jq -r '.[0].customerId')
    STATUS=$(echo $CONTRACTS | jq -r '.[0].status')
    
    # Step 3: Get contracts by customer ID
    if [ ! -z "$CUSTOMER_ID" ]; then
      echo -e "${YELLOW}Testing getContractsByCustomerId for customer ID $CUSTOMER_ID...${NC}"
      CUSTOMER_CONTRACTS=$(curl -s -b cookies.txt "$BASE_URL/api/contracts/customer/$CUSTOMER_ID")
      
      if jq -e . >/dev/null 2>&1 <<< "$CUSTOMER_CONTRACTS"; then
        CUSTOMER_CONTRACT_COUNT=$(echo $CUSTOMER_CONTRACTS | jq '. | length')
        echo -e "${GREEN}Retrieved $CUSTOMER_CONTRACT_COUNT contracts for customer ID $CUSTOMER_ID${NC}"
      else
        echo -e "${RED}Failed to retrieve contracts for customer ID $CUSTOMER_ID${NC}"
      fi
    fi
    
    # Step 4: Get contracts by status
    if [ ! -z "$STATUS" ]; then
      echo -e "${YELLOW}Testing getContractsByStatus for status '$STATUS'...${NC}"
      STATUS_CONTRACTS=$(curl -s -b cookies.txt "$BASE_URL/api/contracts/status/$STATUS")
      
      if jq -e . >/dev/null 2>&1 <<< "$STATUS_CONTRACTS"; then
        STATUS_CONTRACT_COUNT=$(echo $STATUS_CONTRACTS | jq '. | length')
        echo -e "${GREEN}Retrieved $STATUS_CONTRACT_COUNT contracts with status '$STATUS'${NC}"
      else
        echo -e "${RED}Failed to retrieve contracts with status '$STATUS'${NC}"
      fi
    fi
  else
    echo -e "${YELLOW}No contracts found for this merchant${NC}"
  fi
else
  echo -e "${RED}Failed to retrieve contracts or invalid response: $CONTRACTS${NC}"
fi

# Clean up
rm -f cookies.txt

echo -e "${GREEN}Test completed${NC}"