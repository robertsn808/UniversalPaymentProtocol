# Captain Cashout Payment System - Manual Testing Guide

This guide provides comprehensive manual testing instructions for the Captain Cashout payment system, including frontend UI testing, backend API testing, and end-to-end payment flow validation.

## Prerequisites

1. **Environment Setup**
   - Node.js and npm installed
   - Server running on localhost:3000
   - Stripe test API keys configured
   - Test database or mock data ready

2. **Test Data**
   - Stripe test card numbers: `4242 4242 4242 4242` (success), `4000 0000 0000 0002` (decline)
   - Test phone numbers: `+1234567890`
   - Test amounts: $29.99 (base), $0.90 (processing fee)

## Test Scenarios

### 1. Frontend UI Testing

#### 1.1 Page Load and Initial State
```bash
# Test 1: Load Captain Cashout page
curl -I http://localhost:3000/captain-cashout
# Expected: 200 OK, HTML content-type, security headers present

# Test 2: Load success page
curl -I http://localhost:3000/captain-cashout-success
# Expected: 200 OK, HTML content-type, security headers present
```

#### 1.2 Form Validation Testing
1. **Open browser to** `http://localhost:3000/captain-cashout`
2. **Test empty form submission**
   - Click "Create Payment Intent" without filling any fields
   - Expected: Error message "Please fill in all required fields"

3. **Test invalid phone number**
   - Enter: Amount: 29.99, Phone: "invalid", Description: "Test"
   - Expected: Error message "Please enter a valid phone number"

4. **Test negative amount**
   - Enter: Amount: -10, Phone: "+1234567890", Description: "Test"
   - Expected: Error message "Amount must be greater than 0"

5. **Test amount too high**
   - Enter: Amount: 10000, Phone: "+1234567890", Description: "Test"
   - Expected: Error message "Amount exceeds maximum limit"

### 2. Backend API Testing

#### 2.1 Payment Intent Creation API
```bash
# Test 1: Valid payment intent creation
curl -X POST http://localhost:3000/api/captain-cashout/create-intent \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 29.99,
    "description": "Test payment",
    "phoneNumber": "+1234567890",
    "baseAmount": 29.99,
    "processingFee": 0.90
  }'
# Expected: 200 OK, JSON response with clientSecret and paymentIntentId

# Test 2: Invalid amount
curl -X POST http://localhost:3000/api/captain-cashout/create-intent \
  -H "Content-Type: application/json" \
  -d '{
    "amount": -10,
    "description": "Test payment",
    "phoneNumber": "+1234567890"
  }'
# Expected: 400 Bad Request, error message "Invalid amount"

# Test 3: Missing required fields
curl -X POST http://localhost:3000/api/captain-cashout/create-intent \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 29.99
  }'
# Expected: 400 Bad Request, error message "Invalid amount"

# Test 4: Malformed JSON
curl -X POST http://localhost:3000/api/captain-cashout/create-intent \
  -H "Content-Type: application/json" \
  -d 'invalid json'
# Expected: 400 Bad Request, error message about malformed JSON
```

#### 2.2 Rate Limiting Test
```bash
# Test rate limiting by making multiple rapid requests
for i in {1..15}; do
  curl -X POST http://localhost:3000/api/captain-cashout/create-intent \
    -H "Content-Type: application/json" \
    -d '{"amount": 29.99, "description": "Rate limit test", "phoneNumber": "+1234567890"}' &
done
# Expected: Some requests return 429 Too Many Requests
```

### 3. End-to-End Payment Flow Testing

#### 3.1 Complete Payment Success Flow
1. **Navigate to payment page**
   - Open `http://localhost:3000/captain-cashout`
   - Verify page loads correctly with form elements

2. **Fill payment form**
   - Amount: 29.99
   - Phone: +1234567890
   - Description: "Test payment for Captain Cashout"

3. **Create payment intent**
   - Click "Create Payment Intent"
   - Expected: Success message with client secret displayed
   - Verify Stripe Elements form appears

4. **Complete payment with test card**
   - Use test card: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., 12/25)
   - CVC: Any 3 digits (e.g., 123)
   - Click "Pay $29.99"

5. **Verify success redirect**
   - Should redirect to success page
   - Verify transaction details displayed
   - Check transaction ID format (should start with pi_)

#### 3.2 Payment Failure Flow
1. **Repeat steps 1-3 from success flow**
2. **Use declined test card**
   - Card: `4000 0000 0000 0002`
   - Expiry: 12/25
   - CVC: 123

3. **Verify error handling**
   - Payment should fail
   - Error message should be displayed
   - User should be able to retry payment

### 4. Stripe Integration Testing

#### 4.1 Test Stripe Webhook Handling
```bash
# Simulate Stripe webhook for payment success
curl -X POST http://localhost:3000/api/stripe/webhook \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: t=1234567890,v1=test_signature" \
  -d '{
    "id": "evt_test_webhook",
    "object": "event",
    "type": "payment_intent.succeeded",
    "data": {
      "object": {
        "id": "pi_test_123",
        "amount": 2999,
        "currency": "usd",
        "status": "succeeded"
      }
    }
  }'
# Expected: 200 OK, webhook processed successfully
```

#### 4.2 Test Stripe Dashboard Integration
1. **Login to Stripe Dashboard**
   - Go to https://dashboard.stripe.com/test
   - Check Payments section
   - Verify test payments appear with correct metadata
   - Confirm "captain_cashout" service tag is present

### 5. Security Testing

#### 5.1 Header Security Verification
```bash
# Test security headers on payment page
curl -I http://localhost:3000/captain-cashout
# Expected headers:
# - X-Content-Type-Options: nosniff
# - X-Frame-Options: DENY
# - Cache-Control: no-store
# - X-XSS-Protection: 1; mode=block

# Test security headers on success page
curl -I http://localhost:3000/captain-cashout-success
# Expected: Same security headers as above
```

#### 5.2 Input Validation Testing
```bash
# Test XSS prevention
curl -X POST http://localhost:3000/api/captain-cashout/create-intent \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 29.99,
    "description": "<script>alert(\"XSS\")</script>",
    "phoneNumber": "+1234567890"
  }'
# Expected: Script tags should be sanitized or rejected

# Test SQL injection prevention
curl -X POST http://localhost:3000/api/captain-cashout/create-intent \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 29.99,
    "description": "Test'; DROP TABLE users; --",
    "phoneNumber": "+1234567890"
  }'
# Expected: Input should be properly escaped
```

### 6. Performance Testing

#### 6.1 Load Testing
```bash
# Test concurrent payment intent creation
ab -n 100 -c 10 -T 'application/json' -p test_payload.json http://localhost:3000/api/captain-cashout/create-intent

# Where test_payload.json contains:
{
  "amount": 29.99,
  "description": "Load test payment",
  "phoneNumber": "+1234567890",
  "baseAmount": 29.99,
  "processingFee": 0.90
}
# Expected: All requests should complete within reasonable time
```

### 7. Mobile Responsiveness Testing

#### 7.1 Mobile Browser Testing
1. **Open payment page on mobile device or emulator**
2. **Test form input on small screens**
   - Verify all form fields are accessible
   - Check that buttons are properly sized
   - Test virtual keyboard behavior

3. **Test payment flow on mobile**
   - Complete full payment flow using mobile browser
   - Verify Stripe Elements work correctly on mobile

### 8. Error Recovery Testing

#### 8.1 Network Failure Simulation
1. **Simulate network disconnection during payment**
   - Start payment process
   - Disconnect network before completion
   - Reconnect and verify error handling

2. **Test server restart during payment**
   - Start payment process
   - Restart server
   - Verify graceful error handling

### 9. Accessibility Testing

#### 9.1 Keyboard Navigation
1. **Test keyboard-only navigation**
   - Tab through all form fields
   - Verify focus indicators are visible
   - Test Enter key submission

2. **Screen Reader Testing**
   - Use screen reader to navigate form
   - Verify form labels are properly associated
   - Check error messages are announced

## Test Results Documentation

For each test scenario, document:
- Test case ID
- Test description
- Steps performed
- Expected result
- Actual result
- Pass/Fail status
- Notes/Issues found
- Screenshots (for UI tests)

## Automated Test Execution

To run the automated tests alongside manual testing:

```bash
# Run Captain Cashout specific tests
npm test -- captain-cashout.test.ts

# Run all payment-related tests
npm test -- payment

# Run with coverage
npm test -- --coverage captain-cashout.test.ts
```

## Common Issues and Troubleshooting

1. **Stripe API Errors**
   - Verify STRIPE_SECRET_KEY is set correctly
   - Check if using test mode keys
   - Confirm webhook endpoints are configured

2. **Payment Intent Creation Failures**
   - Check server logs for detailed error messages
   - Verify amount is in correct format (dollars, not cents)
   - Confirm all required fields are present

3. **Frontend JavaScript Errors**
   - Check browser console for JavaScript errors
   - Verify Stripe.js is loaded correctly
   - Confirm all DOM elements exist

4. **Rate Limiting Issues**
   - Wait for rate limit window to reset (usually 1 minute)
   - Check server configuration for rate limit settings
   - Verify IP address isn't blocked

## Test Environment Cleanup

After testing completion:
1. Clear test payment data from database
2. Remove test Stripe payment intents from dashboard
3. Reset any modified configuration settings
4. Clear browser cache and cookies
5. Stop any running test servers

This comprehensive testing guide ensures thorough validation of the Captain Cashout payment system across all critical scenarios and edge cases.
