#!/bin/bash
# This script sets up automatic asset report generation and checking
# It creates two cron jobs:
# 1. Generate asset reports for all completed merchants once daily at 1:00 AM
# 2. Check status of pending asset reports every 6 hours

# Ensure script is run with appropriate permissions
if [ "$(id -u)" != "0" ]; then
   echo "This script must be run with administrative privileges (sudo)"
   exit 1
fi

# Define script paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GENERATE_SCRIPT="$SCRIPT_DIR/generate-asset-reports-for-completed-merchants.cjs"
CHECK_SCRIPT="$SCRIPT_DIR/check-asset-reports.js"
LOG_DIR="$SCRIPT_DIR/logs"

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Ensure scripts exist
if [ ! -f "$GENERATE_SCRIPT" ]; then
  echo "Error: Asset report generation script not found: $GENERATE_SCRIPT"
  exit 1
fi

if [ ! -f "$CHECK_SCRIPT" ]; then
  echo "Error: Asset report check script not found: $CHECK_SCRIPT"
  exit 1
fi

# Create temporary crontab file
TEMP_CRONTAB=$(mktemp)
crontab -l > "$TEMP_CRONTAB" 2>/dev/null || true

# Remove any existing cron jobs for these scripts
sed -i "/generate-asset-reports-for-completed-merchants.cjs/d" "$TEMP_CRONTAB"
sed -i "/check-asset-reports.js/d" "$TEMP_CRONTAB"

# Add scheduled tasks to crontab
echo "# Asset Report Generation - Daily at 1:00 AM" >> "$TEMP_CRONTAB"
echo "0 1 * * * cd $SCRIPT_DIR && /usr/bin/node $GENERATE_SCRIPT >> $LOG_DIR/generate-asset-reports-\$(date +\%Y\%m\%d).log 2>&1" >> "$TEMP_CRONTAB"

echo "# Asset Report Status Check - Every 6 hours" >> "$TEMP_CRONTAB"
echo "0 */6 * * * cd $SCRIPT_DIR && /usr/bin/node $CHECK_SCRIPT >> $LOG_DIR/check-asset-reports-\$(date +\%Y\%m\%d).log 2>&1" >> "$TEMP_CRONTAB"

# Install the new crontab
crontab "$TEMP_CRONTAB"
rm "$TEMP_CRONTAB"

echo "Asset report scheduler has been set up successfully"
echo "Asset reports will be generated daily at 1:00 AM"
echo "Asset report status will be checked every 6 hours"
echo "Logs will be stored in: $LOG_DIR"
echo ""
echo "To manually run the scripts immediately:"
echo "node $GENERATE_SCRIPT"
echo "node $CHECK_SCRIPT"
