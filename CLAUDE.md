# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the Universal Payment Protocol (UPP) project - a revolutionary payment processing system that works with ANY internet-connected device. UPP serves as a universal middleware protocol that translates between any device and payment systems, enabling smartphones, Smart TVs, IoT devices, voice assistants, and gaming consoles to process payments.

## Development Commands

### Core Commands
- `npm run dev` - Start development server with tsx
- `npm run build` - Compile TypeScript to JavaScript 
- `npm start` - Run production server
- `npm run demo` - Run the UPP demo showcasing device capabilities
- `npm test` - Run tests with Vitest
- `npm run lint` - Lint TypeScript files with ESLint
- `npm run type-check` - Type check without emitting files

### Environment Setup
Create `.env` file with:
```
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
PORT=3000
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

## Architecture Overview

### Core Components
1. **UPP Translator** (`src/modules/universal-payment-protocol/core/UPPTranslator.ts`) - The main protocol handler that translates between device inputs and payment systems
2. **Device Adapters** - Specific implementations for different device types (smartphone, Smart TV, IoT, voice assistant, gaming console)
3. **Stripe Integration** (`server/stripe-integration.ts`) - Payment gateway processor with real Stripe API integration
4. **Express Server** (`server/index.ts`) - REST API server handling payment requests and device registration

### Device Adapter Pattern
Each device type implements the `UPPDevice` interface with:
- `deviceType` - String identifier for device type
- `capabilities` - DeviceCapabilities object describing input/output methods
- `securityContext` - Security configuration and encryption levels
- `handlePaymentResponse()` - Process successful payment responses
- `handleError()` - Handle payment errors
- `captureUserInput()` - Capture device-specific user input (optional)
- `displayPaymentUI()` - Show payment interface (optional)

### Payment Flow
1. Device registers with UPP system via `/api/register-device`
2. Payment request comes to `/api/process-payment` with device context
3. UPP Translator adapts the input to standard PaymentRequest format
4. Stripe processor handles actual payment processing
5. Response is formatted for the specific device type
6. Device adapter displays confirmation or error

## Project Structure

```
universal-payment-protocol/
├── src/
│   ├── demo/                          # Demo implementations
│   │   └── UPPDemo.ts                 # Comprehensive demo of all device types
│   └── modules/
│       └── universal-payment-protocol/
│           └── core/
│               ├── UPPTranslator.ts   # Core protocol translator (currently mock adapters)
│               └── types.ts           # TypeScript interfaces and types
├── server/
│   ├── index.ts                       # Express server with payment endpoints
│   └── stripe-integration.ts          # Stripe payment processor
├── monitoring/                        # Monitoring infrastructure (empty directories)
│   ├── grafana/
│   └── prometheus.yml/
├── package.json                       # Node.js dependencies and scripts
└── README.md                          # Comprehensive project documentation
```

## Key Implementation Details

### Current State
- **Stripe Integration**: Fully functional with real payment processing
- **Device Adapters**: Multiple adapters implemented (Smartphone, Smart TV, IoT, Voice Assistant)
- **Server**: Production-ready Express server with security middleware
- **Demo System**: Comprehensive demonstration of all device types
- **Testing Infrastructure**: Unit tests, integration tests, and CI/CD pipeline with GitHub Actions
- **Monitoring**: Prometheus and Grafana configurations implemented for observability

### Technology Stack
- **Backend**: Node.js, Express, TypeScript
- **Payment Processing**: Stripe API
- **Security**: Helmet, CORS, AES256 encryption
- **Testing**: Vitest for unit tests, Supertest for API testing, GitHub Actions for CI/CD
- **Monitoring**: Prometheus for metrics, Grafana for dashboards
- **Development**: tsx for TypeScript execution, ESLint for linting
- **Dependencies**: Zod for validation, dotenv for environment management

### Important Notes for Development
- Always run `npm test`, `npm run type-check` and `npm run lint` before committing
- The project uses ES modules (`"type": "module"` in package.json)
- Stripe test keys are required for payment processing functionality
- Device adapters should follow the established interface pattern
- Security context and encryption are critical for device authentication
- All new features should include corresponding unit and integration tests

### Recent Improvements Implemented
- **Test Coverage**: Comprehensive unit and integration tests added
- **Device Adapters**: Smart TV, IoT, and Voice Assistant adapters implemented
- **CI/CD Pipeline**: GitHub Actions workflow for automated testing
- **Monitoring**: Prometheus metrics and Grafana dashboards configured
- **Device Factory**: Factory pattern for device adapter management

### Remaining Implementation Areas
- Additional device adapters (Smartwatch, Gaming Console, Car System)
- Database layer for transaction storage and analytics
- Advanced security features (biometric auth, fraud detection)
- Multi-currency support and international payment methods
- Enhanced error handling and structured logging

## Development Patterns

### Adding New Device Types
1. Create adapter class implementing `UPPDevice` interface in appropriate directory
2. Define device-specific `DeviceCapabilities` and security context
3. Implement `handlePaymentResponse()` and `handleError()` methods
4. Register adapter with DeviceAdapterFactory
5. Add comprehensive unit tests for the new adapter
6. Update demo to showcase new device functionality
7. Add monitoring metrics for the new device type

### Security Considerations
- All payment data uses AES256 encryption
- Device attestation and fingerprinting for authentication
- Biometric and multi-factor authentication support (planned)
- Secure environment validation for trusted devices
- PCI DSS compliance measures for payment processing
- End-to-end encryption for sensitive data transmission

### Testing Strategy
- **Unit Tests**: Test individual components and device adapters
- **Integration Tests**: Test API endpoints with Supertest
- **CI/CD**: Automated testing with GitHub Actions on push/PR
- **Coverage**: Aim for 80%+ test coverage for core functionality
- **Security Testing**: Planned OWASP ZAP integration for security scanning

### Monitoring and Observability
- **Metrics**: Prometheus collects payment processing metrics
- **Dashboards**: Grafana visualizes system performance and payment analytics
- **Alerting**: Configured for critical system metrics and payment failures
- **Logging**: Structured logging for debugging and audit trails

