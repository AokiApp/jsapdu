#!/bin/bash

# Move to the directory of this script
cd "$(dirname "$0")"

# Function to check if pcscd is running and start it if not
check_pcscd() {
  echo "Checking if PC/SC daemon is running..."
  if ! systemctl is-active --quiet pcscd; then
    echo "PC/SC daemon is not running. Starting it..."
    sudo systemctl start pcscd
    if [ $? -ne 0 ]; then
      echo "Failed to start PC/SC daemon. Please check if it's installed."
      echo "You can install it on Debian/Ubuntu with: sudo apt install pcscd libpcsclite1 libpcsclite-dev"
      echo "You can install it on RHEL/CentOS with: sudo yum install pcsc-lite pcsc-lite-devel"
      exit 1
    fi
    echo "PC/SC daemon started successfully."
  else
    echo "PC/SC daemon is already running."
  fi
}

# Build the demo
echo "Building the demo project..."
npm run build

# Check build status
if [ $? -ne 0 ]; then
  echo "Build failed. Aborting."
  exit 1
fi

# Check PC/SC daemon
check_pcscd

# Create a directory for logs
mkdir -p logs

# Run the demo scripts and save their output
echo "Running demo scripts..."

echo "Running list_readers.js..."
node dist/src/list_readers.js | tee logs/list_readers.log
echo

echo "Running card_status.js..."
node dist/src/card_status.js | tee logs/card_status.log
echo

echo "Running transaction.js..."
node dist/src/transaction.js | tee logs/transaction.log
echo

echo "Running send_apdu.js..."
node dist/src/send_apdu.js | tee logs/send_apdu.log
echo

echo "All demos completed. Logs saved to the 'logs' directory."