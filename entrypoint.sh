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
PROXY_IP=$(curl -s --proxy http://127.0.0.1:3128 https://ipinfo.io/ip)
PROXY_COUNTRY=$(curl -s --proxy http://127.0.0.1:3128 https://ipinfo.io/country)
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

# Check if configs.env exists and process NORDVPN
if [ -f "configs.env" ]; then
    echo "Checking VPN configuration..."
    
    # Read NORDVPN value from configs.env (ignoring comments and empty lines)
    NORDVPN_HOST=$(grep -E "^NORDVPN=" configs.env | cut -d'=' -f2- | tr -d '"' | tr -d "'" | head -1)
    
    if [ ! -z "$NORDVPN_HOST" ]; then
        echo "Found NORDVPN host: $NORDVPN_HOST"
        echo "Resolving $NORDVPN_HOST via Squid proxy..."
        
        # Function to validate IP address
        validate_ip() {
            local ip=$1
            if [[ $ip =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
                IFS='.' read -ra ADDR <<< "$ip"
                for i in "${ADDR[@]}"; do
                    if [[ $i -gt 255 || $i -lt 0 ]]; then
                        return 1
                    fi
                done
                return 0
            fi
            return 1
        }
        
        # Method 1: Resolve via DNS over HTTPS through Squid
        echo "Method 1: DNS over HTTPS via Squid..."
        NORDVPN_IP=$(curl -s --proxy http://127.0.0.1:3128 --max-time 10 "https://dns.google/resolve?name=$NORDVPN_HOST&type=A" | grep -o '"data":"[^"]*"' | cut -d'"' -f4 | head -1)
        
        if validate_ip "$NORDVPN_IP"; then
            echo "✅ Resolved $NORDVPN_HOST to IP: $NORDVPN_IP (via DNS over HTTPS)"
        else
            echo "❌ Method 1 failed, trying fallback methods..."
            
            # Method 2: Direct nslookup
            echo "Method 2: Direct nslookup..."
            NORDVPN_IP=$(nslookup $NORDVPN_HOST 8.8.8.8 2>/dev/null | grep -A1 "Name:" | grep "Address:" | awk '{print $2}' | head -1)
            
            if validate_ip "$NORDVPN_IP"; then
                echo "✅ Resolved $NORDVPN_HOST to IP: $NORDVPN_IP (via nslookup)"
            else
                # Method 3: Using dig if available
                echo "Method 3: Using dig..."
                if command -v dig >/dev/null 2>&1; then
                    NORDVPN_IP=$(dig +short $NORDVPN_HOST @8.8.8.8 | head -1)
                    if validate_ip "$NORDVPN_IP"; then
                        echo "✅ Resolved $NORDVPN_HOST to IP: $NORDVPN_IP (via dig)"
                    else
                        echo "❌ All resolution methods failed for $NORDVPN_HOST"
                        NORDVPN_IP=""
                    fi
                else
                    echo "❌ All available resolution methods failed for $NORDVPN_HOST"
                    NORDVPN_IP=""
                fi
            fi
        fi
        
        # Export CHROME_HOST_RULES if we have a valid IP
        if [ ! -z "$NORDVPN_IP" ] && validate_ip "$NORDVPN_IP"; then
            export CHROME_HOST_RULES="MAP * $NORDVPN_IP, EXCLUDE localhost"
            echo "🌐 Exported CHROME_HOST_RULES: $CHROME_HOST_RULES"
            echo "🔒 All traffic will be routed to $NORDVPN_IP (except localhost)"
        else
            echo "⚠️ Warning: Could not resolve $NORDVPN_HOST - Chrome will use default routing"
        fi
    else
        echo "ℹ️ No VPN configuration found in configs.env"
    fi
else
    echo "ℹ️ configs.env not found, skipping VPN resolution"
fi

# execute CMD
echo "$@"
"$@"
