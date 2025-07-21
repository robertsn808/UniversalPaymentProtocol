#!/bin/bash

# UPP API Endpoint Testing Script
# Tests all implemented API endpoints for functionality

set -e

API_BASE="http://localhost:3000"
echo "🌊 Testing UPP API Endpoints..."
echo "API Base URL: $API_BASE"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test function
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local expected_status=$4
    local description=$5
    
    echo -n "Testing $description... "
    
    if [ "$data" = "" ]; then
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$API_BASE$endpoint" \
            -H "Content-Type: application/json" \
            -H "Accept: application/json")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$API_BASE$endpoint" \
            -H "Content-Type: application/json" \
            -H "Accept: application/json" \
            -d "$data")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASS${NC} ($http_code)"
    else
        echo -e "${RED}❌ FAIL${NC} (Expected: $expected_status, Got: $http_code)"
        echo "Response: $body"
    fi
}

echo "🏠 Testing Basic Endpoints"
echo "=========================="
test_endpoint "GET" "/" "" "200" "Root endpoint"
test_endpoint "GET" "/health" "" "200" "Health check"
echo ""

echo "🔐 Testing Authentication Endpoints"
echo "==================================="
# Register a test user
register_data='{"email":"test@example.com","password":"testpassword123","first_name":"Test","last_name":"User"}'
test_endpoint "POST" "/api/auth/register" "$register_data" "201" "User registration"

# Login to get token
login_data='{"email":"test@example.com","password":"testpassword123"}'
login_response=$(curl -s -X POST "$API_BASE/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "$login_data")

# Extract token if login was successful
if echo "$login_response" | grep -q '"success":true'; then
    token=$(echo "$login_response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    echo -e "${GREEN}🔑 Got authentication token${NC}"
else
    echo -e "${YELLOW}⚠️  Using existing user for login test${NC}"
    token=""
fi

test_endpoint "POST" "/api/auth/login" "$login_data" "200" "User login"
echo ""

echo "📱 Testing Device Endpoints"
echo "==========================="
# Register a device
device_data='{"deviceType":"smartphone","capabilities":{"nfc":true,"camera":true,"display":"mobile","audio":true},"fingerprint":"test-device-123","securityContext":{"encryption_level":"high"}}'
test_endpoint "POST" "/api/register-device" "$device_data" "200" "Device registration"

# Test device listing
test_endpoint "GET" "/api/devices" "" "200" "List devices"

# Test with authentication header if we have a token
if [ ! -z "$token" ]; then
    echo -e "${GREEN}🔒 Testing authenticated endpoints${NC}"
    
    # Test protected device listing
    auth_response=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE/api/user/devices" \
        -H "Authorization: Bearer $token" \
        -H "Content-Type: application/json")
    
    auth_code=$(echo "$auth_response" | tail -n1)
    if [ "$auth_code" = "200" ]; then
        echo -e "${GREEN}✅ PASS${NC} (200) - Protected device listing"
    else
        echo -e "${RED}❌ FAIL${NC} - Protected device listing (Got: $auth_code)"
    fi
fi
echo ""

echo "💳 Testing Payment Endpoints"
echo "============================"
# Test payment processing (will fail without Stripe config, but should validate input)
payment_data='{"amount":25.99,"deviceType":"smartphone","deviceId":"test-device-123","description":"Test payment","customerEmail":"test@example.com"}'
test_endpoint "POST" "/api/process-payment" "$payment_data" "500" "Payment processing (expected to fail without Stripe)"

echo ""

echo "🔍 Testing Error Handling"
echo "========================="
test_endpoint "GET" "/api/nonexistent" "" "404" "404 for non-existent endpoint"
test_endpoint "POST" "/api/process-payment" '{"invalid":"data"}' "400" "Invalid payment data"
test_endpoint "POST" "/api/register-device" '{"invalid":"data"}' "400" "Invalid device data"

echo ""
echo "🎉 API Testing Complete!"
echo ""
echo -e "${YELLOW}Note: Some endpoints may fail due to missing configuration (Stripe keys, etc.)${NC}"
echo -e "${YELLOW}This is expected for a development environment.${NC}"