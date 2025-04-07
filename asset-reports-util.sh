#!/bin/bash

# Asset Reports Utility Script
# This script provides an easy way to run the asset reports utilities

# Display header
echo "===================================="
echo "Plaid Asset Reports Utility"
echo "===================================="
echo

# Function to display help
show_help() {
  echo "Usage: ./asset-reports-util.sh [command]"
  echo
  echo "Commands:"
  echo "  check       Check status of all asset reports"
  echo "  generate    Generate new asset reports for all merchants using access tokens"
  echo "  merchant    Generate new asset reports using merchant-specific API keys"
  echo "  schedule    Run the scheduled asset report generator"
  echo "  example     Run the example usage script"
  echo "  help        Display this help message"
  echo
  echo "Examples:"
  echo "  ./asset-reports-util.sh check"
  echo "  ./asset-reports-util.sh generate"
  echo "  ./asset-reports-util.sh merchant"
  echo
}

# Check if command was provided
if [ $# -eq 0 ]; then
  show_help
  exit 1
fi

# Process command
case "$1" in
  "check")
    echo "Checking asset report status..."
    npx tsx asset_reports/check-asset-reports.ts
    ;;
  "generate")
    echo "Generating asset reports using access tokens..."
    npx tsx asset_reports/generate-asset-reports.ts
    ;;
  "merchant")
    echo "Generating asset reports using merchant-specific API keys..."
    npx tsx asset_reports/generate-merchant-reports.ts
    ;;
  "schedule")
    echo "Running scheduled asset report generation..."
    npx tsx asset_reports/schedule-asset-reports.ts
    ;;
  "example")
    echo "Running example asset report workflow..."
    npx tsx asset_reports/example-usage.ts
    ;;
  "help")
    show_help
    ;;
  *)
    echo "Error: Unknown command '$1'"
    echo
    show_help
    exit 1
    ;;
esac

exit 0
