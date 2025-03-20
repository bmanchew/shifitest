#!/bin/bash

# Script to test Twilio API endpoints

# Get the Replit domain
DOMAIN=$(hostname -I | awk '{print $1}')
PORT=3000
BASE_URL="http://${DOMAIN}:${PORT}"

# Color codes for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}ShiFi Twilio API Test Script${NC}"
echo "=====================================
"

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is not installed. Please install it to parse JSON responses.${NC}"
    exit 1
fi

# Function to check API status
check_api_status() {
    echo -e "${BLUE}Checking Twilio service status...${NC}"
    response=$(curl -s "${BASE_URL}/api/twilio/status")
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Error: Failed to connect to the server.${NC}"
        return 1
    fi
    
    # Check if response is valid JSON
    if ! echo "$response" | jq . > /dev/null 2>&1; then
        echo -e "${RED}Error: Invalid response format.${NC}"
        echo "Response: $response"
        return 1
    fi
    
    # Parse and display the status
    success=$(echo "$response" | jq -r '.success')
    if [ "$success" == "true" ]; then
        echo -e "${GREEN}Twilio service status check successful${NC}"
        
        # Extract detailed status information
        isInitialized=$(echo "$response" | jq -r '.status.isInitialized')
        accountSid=$(echo "$response" | jq -r '.status.accountSid')
        authToken=$(echo "$response" | jq -r '.status.authToken')
        phoneNumber=$(echo "$response" | jq -r '.status.phoneNumber')
        mode=$(echo "$response" | jq -r '.status.mode')
        
        echo "Account SID: $accountSid"
        echo "Auth Token: $authToken"
        echo "Phone Number: $phoneNumber"
        echo "Mode: $mode"
        
        if [ "$isInitialized" == "true" ]; then
            echo -e "${GREEN}Twilio is properly initialized and ready to send real messages${NC}"
        else
            echo -e "${YELLOW}Twilio is in simulation mode - no real messages will be sent${NC}"
        fi
    else
        echo -e "${RED}Twilio service status check failed${NC}"
        error=$(echo "$response" | jq -r '.error')
        echo "Error: $error"
        return 1
    fi
}

# Function to test sending an SMS
test_sms() {
    echo -e "\n${BLUE}Testing SMS sending...${NC}"
    
    # Prompt for phone number
    read -p "Enter phone number to receive test SMS: " phone_number
    
    if [ -z "$phone_number" ]; then
        echo -e "${RED}Error: Phone number is required${NC}"
        return 1
    fi
    
    # Prepare the request
    request_body="{\"phoneNumber\":\"$phone_number\",\"message\":\"Test message sent from the Twilio test script.\"}"
    
    # Send the request
    response=$(curl -s -X POST -H "Content-Type: application/json" -d "$request_body" "${BASE_URL}/api/twilio/test-sms")
    
    # Check if response is valid JSON
    if ! echo "$response" | jq . > /dev/null 2>&1; then
        echo -e "${RED}Error: Invalid response format.${NC}"
        echo "Response: $response"
        return 1
    fi
    
    # Parse and display the result
    success=$(echo "$response" | jq -r '.success')
    message=$(echo "$response" | jq -r '.message')
    
    if [ "$success" == "true" ]; then
        echo -e "${GREEN}Test SMS successfully processed${NC}"
        echo "Message: $message"
        messageId=$(echo "$response" | jq -r '.messageId')
        isSimulated=$(echo "$response" | jq -r '.isSimulated')
        
        echo "Message ID: $messageId"
        if [ "$isSimulated" == "true" ]; then
            echo -e "${YELLOW}Note: This was a simulated SMS (no actual message sent)${NC}"
        else
            echo -e "${GREEN}An actual SMS was sent to the phone number${NC}"
        fi
    else
        echo -e "${RED}Test SMS sending failed${NC}"
        error=$(echo "$response" | jq -r '.error')
        echo "Error: $error"
        return 1
    fi
}

# Function to test sending an application via SMS
test_application() {
    echo -e "\n${BLUE}Testing application SMS...${NC}"
    
    # Prompt for required information
    read -p "Enter phone number to receive application: " phone_number
    read -p "Enter merchant ID: " merchant_id
    read -p "Enter amount (e.g. 1000): " amount
    read -p "Enter email (optional): " email
    
    if [ -z "$phone_number" ] || [ -z "$merchant_id" ] || [ -z "$amount" ]; then
        echo -e "${RED}Error: Phone number, merchant ID and amount are required${NC}"
        return 1
    fi
    
    # Prepare the request
    if [ -z "$email" ]; then
        request_body="{\"phoneNumber\":\"$phone_number\",\"merchantId\":$merchant_id,\"amount\":$amount}"
    else
        request_body="{\"phoneNumber\":\"$phone_number\",\"merchantId\":$merchant_id,\"amount\":$amount,\"email\":\"$email\"}"
    fi
    
    # Send the request
    response=$(curl -s -X POST -H "Content-Type: application/json" -d "$request_body" "${BASE_URL}/api/twilio/send-application")
    
    # Check if response is valid JSON
    if ! echo "$response" | jq . > /dev/null 2>&1; then
        echo -e "${RED}Error: Invalid response format.${NC}"
        echo "Response: $response"
        return 1
    fi
    
    # Parse and display the result
    success=$(echo "$response" | jq -r '.success')
    message=$(echo "$response" | jq -r '.message')
    
    if [ "$success" == "true" ]; then
        echo -e "${GREEN}Application SMS successfully processed${NC}"
        echo "Message: $message"
        contractId=$(echo "$response" | jq -r '.contractId')
        applicationUrl=$(echo "$response" | jq -r '.applicationUrl')
        isSimulated=$(echo "$response" | jq -r '.isSimulated')
        
        echo "Contract ID: $contractId"
        echo "Application URL: $applicationUrl"
        
        if [ "$isSimulated" == "true" ]; then
            echo -e "${YELLOW}Note: This was a simulated SMS (no actual message sent)${NC}"
        else
            echo -e "${GREEN}An actual SMS was sent to the phone number${NC}"
        fi
    else
        echo -e "${RED}Application SMS sending failed${NC}"
        error=$(echo "$response" | jq -r '.error')
        echo "Error: $error"
        return 1
    fi
}

# Main menu
main_menu() {
    echo -e "\n${BLUE}Twilio API Test Menu${NC}"
    echo "1. Check Twilio service status"
    echo "2. Send a test SMS"
    echo "3. Send a test application SMS"
    echo "q. Quit"
    read -p "Choose an option: " option
    
    case $option in
        1) check_api_status ;;
        2) test_sms ;;
        3) test_application ;;
        q|Q) echo "Exiting..."; exit 0 ;;
        *) echo -e "${RED}Invalid option${NC}" ;;
    esac
    
    # Return to menu after action completes
    main_menu
}

# Start the script
main_menu