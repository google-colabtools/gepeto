#!/bin/bash

cleanup() {
    echo "Cleaning up..."
    pkill -f squid
    exit 0
}

trap cleanup EXIT

# Start squid proxy in background
squid -N &

# Aguarda o Squid responder na porta 3128
SQUID_TIMEOUT=10
SQUID_COUNTER=0
while ! nc -z 127.0.0.1 3128 2>/dev/null && [ $SQUID_COUNTER -lt $SQUID_TIMEOUT ]; do
    echo "Waiting for squid... ($SQUID_COUNTER/$SQUID_TIMEOUT)"
    sleep 1
    SQUID_COUNTER=$((SQUID_COUNTER + 1))
done

if ! nc -z 127.0.0.1 3128 2>/dev/null; then
    echo "Error: Squid not responding after $SQUID_TIMEOUT seconds"
    exit 1
fi

echo "Squid is ready"

# Show public IP and country via proxy
echo "Testing public IP and country via Squid"
PROXY_RESPONSE=$(curl -s --proxy http://127.0.0.1:3128 https://api.country.is/)
if [ -z "$PROXY_RESPONSE" ]; then
    echo "Public IP: (not detected)"
    echo "Public Country: (not detected)"
else
    # Extract IP and country from JSON response using simple grep/sed
    PROXY_IP=$(echo "$PROXY_RESPONSE" | grep -o '"ip":"[^"]*"' | sed 's/"ip":"\([^"]*\)"/\1/')
    PROXY_COUNTRY=$(echo "$PROXY_RESPONSE" | grep -o '"country":"[^"]*"' | sed 's/"country":"\([^"]*\)"/\1/')
    
    if [ -z "$PROXY_IP" ]; then
        echo "Public IP: (not detected)"
    else
        echo "Public IP: $PROXY_IP"
    fi
    
    if [ -z "$PROXY_COUNTRY" ]; then
        echo "Public Country: (not detected)"
    else
        echo "Public Country: $PROXY_COUNTRY"
    fi
fi

# Function to check available disk space
check_disk_space() {
    echo "=== Disk Space Information ==="
    
    # Get disk usage for current directory (where the container is running)
    CURRENT_DIR=$(pwd)
    echo "Current directory: $CURRENT_DIR"
    
    # Use df to get disk space information
    DISK_INFO=$(df -h "$CURRENT_DIR" | tail -n 1)
    
    if [ -n "$DISK_INFO" ]; then
        # Extract information using awk
        FILESYSTEM=$(echo "$DISK_INFO" | awk '{print $1}')
        TOTAL_SIZE=$(echo "$DISK_INFO" | awk '{print $2}')
        USED_SIZE=$(echo "$DISK_INFO" | awk '{print $3}')
        AVAILABLE_SIZE=$(echo "$DISK_INFO" | awk '{print $4}')
        USE_PERCENT=$(echo "$DISK_INFO" | awk '{print $5}')
        MOUNT_POINT=$(echo "$DISK_INFO" | awk '{print $6}')
        
        echo "Filesystem: $FILESYSTEM"
        echo "Total Size: $TOTAL_SIZE"
        echo "Used: $USED_SIZE"
        echo "Available: $AVAILABLE_SIZE"
        echo "Usage: $USE_PERCENT"
        echo "Mount Point: $MOUNT_POINT"
        
        # Check if available space is less than 1GB and warn
        AVAILABLE_KB=$(df "$CURRENT_DIR" | tail -n 1 | awk '{print $4}')
        AVAILABLE_GB=$((AVAILABLE_KB / 1024 / 1024))
        
        if [ "$AVAILABLE_GB" -lt 1 ]; then
            echo "⚠️  WARNING: Low disk space! Only ${AVAILABLE_SIZE} available"
        else
            echo "✅ Disk space is sufficient: ${AVAILABLE_SIZE} available"
        fi
    else
        echo "❌ Could not retrieve disk space information"
    fi
    echo "================================"
}

# Check disk space before starting
check_disk_space

# execute CMD
echo "$@"
"$@"
