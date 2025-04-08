#!/bin/bash
# This script sets up a cron job to run the asset report generation script at midnight daily

# Make our script executable
chmod +x schedule-asset-reports.cjs

# Get the absolute path to the script
SCRIPT_PATH=$(realpath schedule-asset-reports.cjs)
LOG_DIR=$(realpath asset_reports)

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Create a temporary file for the crontab
TEMP_CRON=$(mktemp)

# Get the existing crontab
crontab -l > "$TEMP_CRON" 2>/dev/null

# Check if the cron job already exists
if grep -q "schedule-asset-reports.cjs" "$TEMP_CRON"; then
    echo "Cron job for asset report generation already exists. Skipping..."
else
    # Add the new cron job to run at midnight daily
    echo "# Run Plaid asset report generation at midnight daily" >> "$TEMP_CRON"
    echo "0 0 * * * $SCRIPT_PATH >> $LOG_DIR/cron-asset-reports.log 2>&1" >> "$TEMP_CRON"
    
    # Install the updated crontab
    crontab "$TEMP_CRON"
    echo "Cron job for asset report generation scheduled to run at midnight daily."
fi

# Clean up the temporary file
rm "$TEMP_CRON"

echo "Setup complete. Asset reports will be generated daily and logs will be stored in $LOG_DIR."