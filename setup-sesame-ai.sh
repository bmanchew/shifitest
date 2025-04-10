#!/bin/bash
# Setup script for SesameAI and DataCrunch integration

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=======================================${NC}"
echo -e "${BLUE}   SesameAI DataCrunch Setup Script    ${NC}"
echo -e "${BLUE}=======================================${NC}"

# Check if Python 3.11 is installed
echo -e "\n${YELLOW}Checking Python version...${NC}"
PYTHON_CMD="python3.11"
if ! command -v $PYTHON_CMD &> /dev/null; then
    echo -e "${RED}Python 3.11 is not installed or not in PATH${NC}"
    echo -e "${YELLOW}Will try using python3 instead${NC}"
    PYTHON_CMD="python3"
    
    if ! command -v $PYTHON_CMD &> /dev/null; then
        echo -e "${RED}Error: Python 3 is not installed or not in PATH${NC}"
        echo -e "${RED}Please install Python 3.11 or later${NC}"
        exit 1
    fi
    
    # Check Python version
    PYTHON_VERSION=$($PYTHON_CMD --version | cut -d' ' -f2)
    echo -e "${YELLOW}Detected Python version: ${PYTHON_VERSION}${NC}"
    
    # Compare version with 3.11
    if [[ "$(echo "$PYTHON_VERSION" | cut -d. -f1)" -lt 3 || ("$(echo "$PYTHON_VERSION" | cut -d. -f1)" -eq 3 && "$(echo "$PYTHON_VERSION" | cut -d. -f2)" -lt 11) ]]; then
        echo -e "${RED}Error: Python 3.11 or later is required${NC}"
        echo -e "${RED}Current version: ${PYTHON_VERSION}${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}Python check passed ✓${NC}"

# Check for required dependencies
echo -e "\n${YELLOW}Checking required Python packages...${NC}"
REQUIRED_PACKAGES="requests numpy soundfile"

for package in $REQUIRED_PACKAGES; do
    if ! $PYTHON_CMD -c "import $package" &> /dev/null; then
        echo -e "${YELLOW}Installing ${package}...${NC}"
        $PYTHON_CMD -m pip install $package
        if [ $? -ne 0 ]; then
            echo -e "${RED}Failed to install ${package}${NC}"
            exit 1
        fi
    fi
done

echo -e "${GREEN}Package dependencies check passed ✓${NC}"

# Create necessary directories
echo -e "\n${YELLOW}Creating necessary directories...${NC}"
mkdir -p public/audio

# Check if DataCrunch API environment variables are set
echo -e "\n${YELLOW}Checking DataCrunch and HuggingFace API configuration...${NC}"
API_STATUS=$($PYTHON_CMD sesamechat/csm/setup_api_env.py --check-only)
echo $API_STATUS | grep -q '"datacrunch_url":'
DATACRUNCH_URL_SET=$?
echo $API_STATUS | grep -q '"datacrunch_api_key_set": true'
DATACRUNCH_KEY_SET=$?
echo $API_STATUS | grep -q '"huggingface_api_key_set": true'
HUGGINGFACE_KEY_SET=$?

# Prompt for missing configuration
if [ $DATACRUNCH_URL_SET -ne 0 ] || [ $DATACRUNCH_KEY_SET -ne 0 ] || [ $HUGGINGFACE_KEY_SET -ne 0 ]; then
    echo -e "${YELLOW}Some API configuration is missing. Would you like to configure it now? (y/n)${NC}"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        # Prompt for DataCrunch URL if not set
        if [ $DATACRUNCH_URL_SET -ne 0 ]; then
            echo -e "${YELLOW}Enter DataCrunch API URL:${NC}"
            read -r datacrunch_url
        else
            datacrunch_url=""
        fi
        
        # Prompt for DataCrunch API key if not set
        if [ $DATACRUNCH_KEY_SET -ne 0 ]; then
            echo -e "${YELLOW}Enter DataCrunch API Key:${NC}"
            read -r datacrunch_api_key
        else
            datacrunch_api_key=""
        fi
        
        # Prompt for HuggingFace API key if not set
        if [ $HUGGINGFACE_KEY_SET -ne 0 ]; then
            echo -e "${YELLOW}Enter HuggingFace API Key:${NC}"
            read -r huggingface_api_key
        else
            huggingface_api_key=""
        fi
        
        # Update configuration
        $PYTHON_CMD sesamechat/csm/setup_api_env.py \
            --datacrunch-url "$datacrunch_url" \
            --datacrunch-api-key "$datacrunch_api_key" \
            --huggingface-api-key "$huggingface_api_key"
        
        echo -e "${GREEN}API configuration updated ✓${NC}"
    else
        echo -e "${YELLOW}Skipping API configuration${NC}"
    fi
else
    echo -e "${GREEN}API configuration check passed ✓${NC}"
fi

# Test the DataCrunch integration
echo -e "\n${YELLOW}Would you like to test the DataCrunch integration? (y/n)${NC}"
read -r response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
    echo -e "${YELLOW}Running test script...${NC}"
    $PYTHON_CMD sesamechat/csm/test_datacrunch.py
    if [ $? -ne 0 ]; then
        echo -e "${RED}Test failed${NC}"
    else
        echo -e "${GREEN}Test completed successfully ✓${NC}"
    fi
else
    echo -e "${YELLOW}Skipping integration test${NC}"
fi

echo -e "\n${GREEN}Setup completed!${NC}"
echo -e "${BLUE}=======================================${NC}"
echo -e "${YELLOW}You can now use the DataCrunch integration in your SesameAI application.${NC}"
echo -e "${YELLOW}The service will automatically prefer DataCrunch when available, falling back to Hugging Face or local engines when needed.${NC}"
echo -e "${BLUE}=======================================${NC}"