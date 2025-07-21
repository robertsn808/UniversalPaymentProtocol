// Test setup file for UPP
import { beforeEach, afterEach, beforeAll, afterAll } from 'vitest';

// Mock environment variables
beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key_for_testing';
  process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_mock_key_for_testing';
  process.env.PORT = '3001';
});

// Setup and cleanup for each test
beforeEach(() => {
  // Reset any state between tests
  console.log = vi.fn(); // Mock console.log to avoid noise in tests
});

afterEach(() => {
  // Cleanup after each test
  vi.clearAllMocks();
});

// Global test utilities
global.testUtils = {
  createMockPaymentRequest: () => ({
    amount: 25.99,
    deviceType: 'smartphone',
    deviceId: 'test_device_123',
    description: 'Test payment',
    customerEmail: 'test@example.com',
    metadata: { test: true }
  }),
  
  createMockDeviceRegistration: () => ({
    deviceType: 'smartphone',
    capabilities: {
      internet_connection: true,
      display: 'touchscreen' as const,
      input_methods: ['touch', 'voice'],
      nfc: true,
      camera: true
    },
    fingerprint: 'test_fingerprint_123',
    securityContext: {
      encryption_level: 'AES256',
      device_attestation: 'trusted'
    }
  })
};

// Declare global types for TypeScript
declare global {
  var testUtils: {
    createMockPaymentRequest: () => any;
    createMockDeviceRegistration: () => any;
  };
}