# Universal Payment Protocol - Testing

This directory contains all tests for the Universal Payment Protocol implementation.

## Test Structure

```
tests/
├── unit/           # Unit tests for individual components
│   ├── core/       # Core UPP protocol tests
│   └── stripe/     # Stripe integration tests
├── integration/    # API and integration tests
├── setup.ts        # Test setup and configuration
└── README.md       # This file
```

## Running Tests

### Unit Tests

```bash
npm run test
```

### Specific Test Files

```bash
# Run core protocol tests
npm run test tests/unit/core

# Run Stripe integration tests
npm run test tests/unit/stripe

# Run API integration tests
npm run test tests/integration
```

## Test Coverage

### Core Protocol Tests
- Device registration and validation
- Payment processing workflow
- Error handling and edge cases
- Device discovery mechanisms

### Stripe Integration Tests
- Payment intent creation
- Payment confirmation
- Customer creation
- Refund processing
- Error scenarios

### API Integration Tests
- Health check endpoints
- Payment processing endpoints
- Device registration endpoints
- Error response handling

## Writing New Tests

1. Place unit tests in the appropriate subdirectory under `tests/unit/`
2. Place integration tests in `tests/integration/`
3. Follow the existing naming convention: `[component].test.ts`
4. Use descriptive test descriptions
5. Test both happy paths and error conditions

## Mocking Strategy

- Use `vitest` mocking capabilities for unit tests
- Mock external services (Stripe, databases) to isolate components
- Use in-memory data structures for stateful tests
- Create realistic mock data that matches production formats

## Continuous Integration

Tests are automatically run on every push and pull request through GitHub Actions:

- Node.js 18.x and 20.x compatibility
- Linting and type checking
- Full test suite execution
- Build verification

## Test Data Management

- Use factory functions to create test data
- Clean up test data after each test
- Use realistic but non-sensitive test data
- Parameterize tests for different scenarios
