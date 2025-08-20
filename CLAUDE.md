# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Universal Payment Protocol (UPP)

This is a revolutionary payment processing system that enables ANY internet-connected device to become a payment terminal. The project aims to create a universal middleware protocol for payments, similar to how IV enables ML library interoperability.

## Development Commands

### Core Commands
- `npm run dev` - Start development server (tsx src/server/index.ts)
- `npm run build` - Build TypeScript to JavaScript (tsc)
- `npm start` - Run production server (node dist/index.js)
- `npm run demo` - Run the UPP demo (tsx src/demo/UPPDemo.ts)
- `npm test` - Run tests with Vitest
- `npm run lint` - Lint TypeScript files with ESLint
- `npm run type-check` - Run TypeScript type checking without emitting files

### Environment Setup
- Copy `.env.example` to `.env` and configure Stripe keys
- Required: `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY`
- Optional: `PORT`, `FRONTEND_URL`, `NODE_ENV`

## Architecture Overview

### Core Concept
UPP acts as a universal translator between any internet-connected device and payment systems. The architecture follows a device-agnostic approach where:

1. **UPP Translator** (`src/modules/universal-payment-protocol/core/UPPTranslator.ts`) - Core protocol logic
2. **Device Adapters** - Device-specific implementations (e.g., SmartphoneAdapter)
3. **Payment Gateway Integration** - Currently Stripe-based processing
4. **Express Server** (`server/index.ts`) - RESTful API endpoints

### Device Support Strategy
The system is designed to support ANY device with internet connectivity through:
- **Capability Detection** - Each device declares its capabilities (NFC, camera, display, etc.)
- **Input Method Abstraction** - Voice, touch, NFC, QR codes, sensor triggers, etc.
- **Adaptive UI** - Different response formats for different device types (mobile notifications, TV full-screen, IoT LED patterns, voice responses)

### Key Interfaces
- `UPPDevice` - Core device interface all adapters must implement
- `DeviceCapabilities` - Standardized capability declaration
- `PaymentRequest`/`PaymentResult` - Standardized payment data structures
- Device-specific response types: `MobileResponse`, `IoTResponse`, `VoiceResponse`, `TVResponse`

### Module Structure
```
src/
├── server/                     # Express.js API server
├── modules/
│   ├── universal-payment-protocol/
│   │   ├── core/              # Core UPP logic and types
│   │   └── devices/           # Device-specific adapters
│   └── payments/              # Payment processing logic
└── demo/                      # Comprehensive demo system
```

## Technology Stack
- **TypeScript** - Primary language
- **Express.js** - Web server framework
- **Stripe** - Payment processing
- **Zod** - Runtime type validation
- **Vitest** - Testing framework
- **tsx** - TypeScript execution for development

## Development Notes

### Adding New Device Types
1. Create device adapter implementing `UPPDevice` interface
2. Define device-specific capabilities and security context
3. Implement required methods: `handlePaymentResponse`, `handleError`
4. Optional: `displayPaymentUI`, `captureUserInput` for interactive devices
5. Register device with UPP core system

### Payment Flow
1. Device registration with capability declaration
2. Payment request processing through UPP translator
3. Stripe payment intent creation
4. Device-specific response formatting and delivery

### Security Considerations
- All devices must declare security context (encryption level, authentication)
- Payment data is processed through secure Stripe integration
- Device fingerprinting for identification and fraud prevention

## Demo System
The comprehensive demo (`src/demo/UPPDemo.ts`) showcases:
- Smartphone NFC payments
- Smart TV QR code payments  
- IoT device automated purchasing
- Voice assistant voice commands
- Gaming console controller navigation

Run with `npm run demo` to see the full capability demonstration.

## GitHub Guidelines
- Do not add your signature on anything to github including commits and pull requests
- Remember where you left off
- Your main front page is at:
- http://localhost:9000/ - This is your UPP landing page
- The seafood market data in /src/modules/pos/data/seafood-products.ts contains the fish market catalog
- This appears to be the Alii Fish Market duplicate you're referring to

POS System Access

Access the POS system at:
- http://localhost:9000/pos - Main POS Dashboard
- API Endpoints: /api/pos/*
- GET /api/pos/products - Product catalog
- POST /api/pos/order - Create orders
- POST /api/pos/payment - Process payments
- GET /api/pos/categories - Product categories

Key System URLs:

1. Main Landing: http://localhost:9000/
2. Demo Dashboard: http://localhost:9000/demo
3. POS System: http://localhost:9000/pos
4. API Key Registration: http://localhost:9000/register
5. AI Monitoring: http://localhost:9000/ai-monitoring
6. Health Check: http://localhost:9000/health

Demo Dashboard Fix

I've improved the error handling to show the actual error message instead of a generic one. This will help
identify what's causing the "require is not defined" error.

Seafood Market Features

Your system includes:
- 🐟 Fresh Fish (daily catch)
- 🦐 Shellfish & Crustaceans
- 🦪 Mollusks (oysters, clams, mussels)
- 🍤 Prepared Seafood
- ❄ Frozen Selections
- 🔥 Smoked & Cured fish

The POS system is fully integrated with UPP payment processing and includes inventory management, sales
tracking, and comprehensive seafood product catalogs that mirror a real fish market operation.