#!/bin/bash

# Setup Asset Report Cron Job
# This script sets up a cron job to run the asset report scheduler weekly

echo "===================================="
echo "Setting up Asset Report Cron Job"
echo "===================================="
echo

# Get the current directory
CURRENT_DIR=$(pwd)

# Define the cron command - runs every Monday at 3:00 AM
CRON_CMD="0 3 * * 1 cd $CURRENT_DIR && /usr/bin/npx tsx asset_reports/schedule-asset-reports.ts >> $CURRENT_DIR/asset-reports-cron.log 2>&1"

# Check if the cron job already exists
EXISTING_CRON=$(crontab -l 2>/dev/null | grep "asset_reports/schedule-asset-reports.ts")

if [ -n "$EXISTING_CRON" ]; then
    echo "Asset report cron job already exists. Exiting."
    exit 0
fi

# Add the cron job
(crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -

if [ $? -eq 0 ]; then
    echo "Asset report cron job has been set up successfully."
    echo "The job will run every Monday at 3:00 AM."
    echo "Log file will be created at: $CURRENT_DIR/asset-reports-cron.log"
else
    echo "Failed to set up cron job. Please try again or set it up manually."
    echo "Cron command to use:"
    echo "$CRON_CMD"
fi

echo
echo "To verify the cron job has been set up, run: crontab -l"
echo

chmod +x "$CURRENT_DIR/asset-reports-util.sh"
echo "Asset reports utility script is now executable."

exit 0
