#!/bin/bash

# Find IP Address for NFC Testing Script

echo "🌊 Finding your IP address for NFC testing..."
echo "=============================================="
echo ""

# Get the primary network interface IP
if command -v ip &> /dev/null; then
    # Linux with ip command
    IP_ADDRESS=$(ip route get 1.1.1.1 | awk '{print $7; exit}')
elif command -v ifconfig &> /dev/null; then
    # macOS/Linux with ifconfig
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        IP_ADDRESS=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')
    else
        # Linux
        IP_ADDRESS=$(ifconfig | grep -oP 'inet addr:\K\S+' | grep -v 127.0.0.1 | head -1)
    fi
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    # Windows (Git Bash/Cygwin)
    IP_ADDRESS=$(ipconfig | grep -A 1 "Wireless LAN adapter Wi-Fi:" | grep "IPv4" | awk '{print $NF}' | tr -d '\r')
    if [ -z "$IP_ADDRESS" ]; then
        IP_ADDRESS=$(ipconfig | grep -A 1 "Ethernet adapter:" | grep "IPv4" | awk '{print $NF}' | tr -d '\r')
    fi
else
    echo "❌ Could not automatically detect IP address"
    echo "Please find your IP address manually:"
    echo ""
    echo "Windows: ipconfig"
    echo "macOS: ifconfig en0 | grep inet"
    echo "Linux: ip addr show"
    exit 1
fi

if [ -z "$IP_ADDRESS" ]; then
    echo "❌ Could not find IP address automatically"
    echo ""
    echo "Please find your IP address manually:"
    echo "- Windows: Open Command Prompt and run 'ipconfig'"
    echo "- macOS: Open Terminal and run 'ifconfig en0 | grep inet'"
    echo "- Linux: Open Terminal and run 'ip addr show'"
    echo ""
    echo "Look for your local network IP (usually starts with 192.168.x.x or 10.x.x.x)"
    exit 1
fi

echo "✅ Found your IP address: $IP_ADDRESS"
echo ""
echo "🔧 Setup Instructions:"
echo "====================="
echo ""
echo "1. Make sure your UPP server is running:"
echo "   PORT=9001 STRIPE_SECRET_KEY=sk_test_demo_key_for_development_only STRIPE_PUBLISHABLE_KEY=pk_test_demo_key_for_development_only npm run dev"
echo ""
echo "2. On your phone, open your web browser and visit:"
echo "   📱 http://$IP_ADDRESS:9001/nfc-test"
echo ""
echo "3. Make sure both your computer and phone are on the same WiFi network!"
echo ""
echo "🔥 Quick Test URLs:"
echo "=================="
echo "Health Check: http://$IP_ADDRESS:9001/health"
echo "NFC Test:     http://$IP_ADDRESS:9001/nfc-test"
echo "Main API:     http://$IP_ADDRESS:9001/"
echo ""
echo "🛡️ Firewall Note:"
echo "=================="
echo "If it still doesn't work, you may need to:"
echo "- Allow port 9001 through your firewall"
echo "- Check if your router blocks device-to-device communication"
echo "- Try disabling firewall temporarily for testing"
echo ""
echo "🌊 Happy NFC Testing! 📱💳✨"