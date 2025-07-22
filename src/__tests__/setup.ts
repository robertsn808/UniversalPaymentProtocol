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
  // console.log = vi.fn(); // Mock console.log to avoid noise in tests - disabled for debugging
});

afterEach(() => {
  // Cleanup after each test
  vi.clearAllMocks();
});

// Global test utilities - using dynamic imports to avoid conflicts

// Declare global types for TypeScript - removed to avoid conflicts