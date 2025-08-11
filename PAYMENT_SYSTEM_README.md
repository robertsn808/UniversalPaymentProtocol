
# Universal Payment Protocol - Native Payment System

## Overview

The Universal Payment Protocol (UPP) now features a completely native payment processing system that bypasses traditional payment gateways like Stripe. Instead, we process payments directly through Visa Direct APIs and other card network integrations, significantly reducing transaction fees and providing greater control over the payment flow.

## Architecture

### Core Components

1. **Visa Direct Processor** (`src/payments/visa-direct-processor.ts`)
   - Direct integration with Visa's payment APIs
   - Handles fund transfers, card tokenization, and transaction processing
   - Supports both sandbox and production environments

2. **Universal Payment Gateway** (`src/payments/universal-payment-gateway.ts`)
   - Unified interface for all payment operations
   - Manages payment intents, customers, and payment methods
   - Provides Stripe-compatible API surface for easy migration

3. **Payment Processor Factory** (`src/payments/payment-processor-factory.ts`)
   - Creates appropriate payment processors based on configuration
   - Supports both live Visa Direct integration and mock processors for testing

4. **Multi-Currency System** (`src/payments/multi-currency.ts`)
   - Handles currency conversion and exchange rates
   - Supports global payments with minimal fees

## Key Features

### Direct Card Network Integration
- **Visa Direct**: Direct fund transfers and card payments
- **Mastercard Send**: (Future implementation)
- **Lower Fees**: Bypass gateway fees, pay only interchange + small processing fee
- **Real-time Processing**: Direct API communication with card networks

### Secure Card Tokenization
- Cards are tokenized using Visa Token Service (VTS)
- PCI DSS compliant token storage
- Secure payment processing without storing sensitive card data

### Multi-Currency Support
- 20+ supported currencies
- Real-time exchange rates
- Regional payment method optimization

### Device Payment Processing
- Universal device support (smartphones, IoT, smart TVs, etc.)
- Device-specific payment flows
- Enhanced metadata tracking

## Setup Instructions

### 1. Visa Direct Configuration

To use live Visa Direct integration, you need:

1. **Visa Developer Account**: Sign up at https://developer.visa.com
2. **Visa Direct Credentials**: Obtain user ID and password
3. **SSL Certificates**: Download client certificates for API authentication

Set environment variables:
```bash
VISA_USER_ID=your_visa_user_id
VISA_PASSWORD=your_visa_password
VISA_CERT_PATH=/path/to/visa_cert.pem
VISA_KEY_PATH=/path/to/visa_key.pem
VISA_API_BASE_URL=https://sandbox.api.visa.com  # or production URL
```

### 2. Database Setup

Run the database schema to create necessary tables:
```sql
-- Run the schema in src/database/schema.sql
-- This creates tables for transactions, payment_intents, customers, etc.
```

### 3. Environment Configuration

Copy `.env.example` to `.env` and configure:
```env
NODE_ENV=development
PORT=5000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/upp_db

# Visa Direct
VISA_USER_ID=demo_mode  # Change to real credentials for live processing
VISA_PASSWORD=demo_mode
VISA_CERT_PATH=/tmp/visa_cert.pem
VISA_KEY_PATH=/tmp/visa_key.pem

# Security
JWT_SECRET=your-super-secret-jwt-key
ENCRYPTION_KEY=your-32-character-encryption-key

# Features
ENABLE_MULTI_CURRENCY=true
ENABLE_AUDIT_TRAIL=true
```

## API Usage

### Process Payment
```javascript
// Standard payment processing
const result = await fetch('/api/process-payment', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    amount: 100.00,
    currency: 'USD',
    description: 'Test payment',
    payment_method: 'card',
    card_data: {
      number: '4242424242424242',
      exp_month: '12',
      exp_year: '2025',
      cvv: '123',
      holder_name: 'John Doe'
    },
    customer_email: 'customer@example.com'
  })
});

const payment = await result.json();
console.log('Payment result:', payment);
```

### Device Payment Processing
```javascript
// Device-specific payment
const devicePayment = await fetch('/api/process-device-payment', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    amount: 50.00,
    deviceType: 'smartphone',
    deviceId: 'device_12345',
    description: 'Mobile app purchase',
    customerEmail: 'user@mobile.com',
    cardData: {
      token: 'visa_token_abc123'  // Previously tokenized card
    }
  })
});
```

### Payment Intents (Stripe-compatible)
```javascript
// Create payment intent
const intent = await fetch('/api/payment-intents', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    amount: 200.00,
    currency: 'USD',
    customer_email: 'customer@example.com'
  })
});

// Confirm payment intent
const confirmation = await fetch(`/api/payment-intents/${intent.id}/confirm`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    payment_method_data: {
      card: {
        number: '4242424242424242',
        exp_month: '12',
        exp_year: '2025',
        cvv: '123'
      }
    }
  })
});
```

### Customer and Payment Method Management
```javascript
// Create customer
const customer = await fetch('/api/customers', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'customer@example.com',
    name: 'John Doe',
    metadata: { source: 'web_app' }
  })
});

// Create payment method
const paymentMethod = await fetch('/api/payment-methods', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'card',
    customer_id: customer.id,
    card: {
      number: '4242424242424242',
      exp_month: '12',
      exp_year: '2025',
      cvv: '123',
      holder_name: 'John Doe'
    }
  })
});
```

## Cost Structure

### Traditional Gateway vs UPP Native

**Stripe/PayPal (Traditional)**:
- Processing fee: 2.9% + $0.30 per transaction
- Additional fees for international cards, currency conversion
- Example: $100 transaction = $3.20 in fees

**UPP Native (Visa Direct)**:
- Visa Direct fee: ~$0.25 per transaction
- Interchange fee: ~1.4% + $0.05 (paid to issuing bank)
- Example: $100 transaction = ~$1.70 in fees
- **Savings: ~47% reduction in processing costs**

### Fee Breakdown
- **Processing Fee**: Fixed $0.25 per Visa Direct transaction
- **Interchange Fee**: Variable based on card type (typically 1.4% + $0.05)
- **Network Fee**: Minimal network assessment fees
- **No Gateway Fees**: Direct integration eliminates middleman costs

## Security Features

### PCI DSS Compliance
- Card data is immediately tokenized using Visa Token Service
- No raw card data stored in our systems
- Secure transmission using TLS 1.3
- AES-256 encryption for data at rest

### Fraud Prevention
- Real-time transaction monitoring
- Velocity checking and anomaly detection
- Address verification and CVV checking
- 3D Secure authentication support (future)

### Audit Trail
- Complete transaction logging
- Compliance reporting
- Real-time monitoring and alerting
- Secure audit data storage

## Testing

### Test Cards
Use these Visa test card numbers in sandbox mode:

- **Successful payment**: 4242424242424242
- **Declined payment**: 4000000000000002
- **Insufficient funds**: 4000000000009995
- **Expired card**: 4000000000000069
- **CVV failure**: 4000000000000127

### Running Tests
```bash
# Run payment system tests
npm test src/__tests__/payment-system.test.ts

# Run integration tests
npm test src/__tests__/server.test.ts

# Run all tests
npm test
```

## Monitoring and Analytics

### Real-time Metrics
- Transaction success rates
- Processing times
- Fee analysis
- Currency conversion rates
- Device payment statistics

### Audit and Compliance
- PCI DSS compliance monitoring
- Transaction audit trails
- Regulatory reporting
- Risk assessment metrics

## Migration from Stripe

### API Compatibility
The UPP payment system provides a Stripe-compatible API surface, making migration straightforward:

1. **Payment Intents**: Direct replacement for Stripe Payment Intents
2. **Customers**: Compatible customer management
3. **Payment Methods**: Card tokenization and storage
4. **Webhooks**: Event-driven architecture (future implementation)

### Migration Steps
1. Update environment variables (remove Stripe keys, add Visa credentials)
2. Test payment flows in sandbox mode
3. Update webhook handlers (if using)
4. Deploy and monitor
5. Gradually migrate payment volume

## Future Enhancements

### Planned Features
1. **Mastercard Send Integration**: Support for Mastercard payments
2. **ACH/Bank Transfer**: Direct bank account payments
3. **Digital Wallets**: Apple Pay, Google Pay integration
4. **3D Secure**: Enhanced authentication
5. **Subscription Billing**: Recurring payment support
6. **Marketplace Payments**: Split payments and payouts

### International Expansion
1. **Regional Payment Methods**: Support for local payment methods
2. **Regulatory Compliance**: Country-specific compliance features
3. **Local Currency Processing**: Reduce FX costs
4. **Regional Card Networks**: Support for local card networks

## Support and Documentation

### Resources
- [Visa Developer Documentation](https://developer.visa.com)
- [UPP API Reference](./API_REFERENCE.md)
- [Security Guidelines](./SECURITY.md)
- [Compliance Documentation](./COMPLIANCE.md)

### Getting Help
- GitHub Issues: Report bugs and feature requests
- Email Support: support@upp.dev
- Developer Discord: [UPP Developer Community]

## License

This payment system is part of the Universal Payment Protocol and is licensed under the MIT License. See [LICENSE](./LICENSE) for details.

---

**⚠️ Important**: This system processes real payments when configured with live Visa Direct credentials. Ensure proper testing and compliance before deploying to production.
