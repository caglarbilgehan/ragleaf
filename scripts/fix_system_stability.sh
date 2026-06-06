#!/bin/bash
# System Stability Fix Script for Ragleaf Host
# This script must be run as root (sudo)

echo "=== System Stability Fix Script ==="

# 1. Increase Swap Space to 8GB
echo "1. Configuring 8GB Swap Space..."
if [ -f /swapfile ]; then
    echo "Deactivating existing swapfile..."
    sudo swapoff /swapfile 2>/dev/null
    sudo rm -f /swapfile
fi

echo "Creating 8GB swapfile (this might take a minute)..."
sudo dd if=/dev/zero of=/swapfile bs=1M count=8192 status=progress
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Ensure it's in /etc/fstab
if ! grep -q "/swapfile" /etc/fstab; then
    echo "Adding swapfile to /etc/fstab for persistence..."
    echo "/swapfile none swap sw 0 0" | sudo tee -a /etc/fstab
fi
echo "Swap Space successfully increased to 8GB!"

# 2. Force Chrome Remote Desktop to use Xorg
echo "2. Configuring Chrome Remote Desktop to use Xorg..."
ENV_FILE="/etc/environment"
if ! grep -q "CHROME_REMOTE_DESKTOP_USE_XORG" "$ENV_FILE"; then
    echo "export CHROME_REMOTE_DESKTOP_USE_XORG=1" | sudo tee -a "$ENV_FILE"
    echo "Added CHROME_REMOTE_DESKTOP_USE_XORG=1 to $ENV_FILE"
else
    echo "CHROME_REMOTE_DESKTOP_USE_XORG is already configured in $ENV_FILE"
fi

# 3. Restart Chrome Remote Desktop service
echo "3. Restarting Chrome Remote Desktop service..."
sudo systemctl restart chrome-remote-desktop@cserver.service

echo "=== Stability Fixes Applied Successfully! ==="
echo "Please restart any open Chrome or IDE sessions to apply GPU changes."
