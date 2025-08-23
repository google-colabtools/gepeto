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
    echo "Error: Squid not responding on port 3128 after $SQUID_TIMEOUT seconds"
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
# execute CMD
echo "$@"
"$@"
