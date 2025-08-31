import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../../server/index.js';

// Mock the payment processor
vi.mock('../../server/stripe-integration.js', () => ({
  createPaymentProcessor: vi.fn(() => ({
    createPaymentIntent: vi.fn(),
    createCheckoutSession: vi.fn(),
  }))
}));

// Mock SecureFileHandler
vi.mock('../../src/utils/file-security.js', () => ({
  SecureFileHandler: {
    fileExistsSecurely: vi.fn(),
    readFileSecurely: vi.fn(),
    getFileInfoSecurely: vi.fn(),
  }
}));

describe('Captain Cashout Payment System', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock file operations
    const { SecureFileHandler } = require('../../src/utils/file-security.js');
    SecureFileHandler.fileExistsSecurely.mockResolvedValue(true);
    SecureFileHandler.readFileSecurely.mockResolvedValue('<html>Mock HTML</html>');
    SecureFileHandler.getFileInfoSecurely.mockReturnValue({
      exists: true,
      size: 100,
      extension: '.html',
      lastModified: new Date(),
    });
  });

  describe('GET /captain-cashout', () => {
    it('should serve the Captain Cashout page successfully', async () => {
      const response = await request(app)
        .get('/captain-cashout')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/html');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.text).toContain('Mock HTML');
    });

    it('should handle file not found error', async () => {
      const { SecureFileHandler } = require('../../src/utils/file-security.js');
      SecureFileHandler.fileExistsSecurely.mockResolvedValue(false);

      const response = await request(app)
        .get('/captain-cashout')
        .expect(404);

      expect(response.body.error).toBe('Captain Cashout page not found');
    });
  });

  describe('GET /captain-cashout-success', () => {
    it('should serve the success page successfully', async () => {
      const response = await request(app)
        .get('/captain-cashout-success')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/html');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.text).toContain('Mock HTML');
    });
  });

  describe('POST /api/captain-cashout/create-intent', () => {
    const validRequest = {
      amount: 29.99,
      description: 'Test payment',
      phoneNumber: '+1234567890',
      baseAmount: 29.99,
      processingFee: 0.90
    };

    it('should create payment intent successfully', async () => {
      const mockProcessor = {
        createPaymentIntent: vi.fn().mockResolvedValue({
          id: 'pi_test_123',
          client_secret: 'pi_test_secret_123',
        }),
      };

      const { createPaymentProcessor } = await import('../../server/stripe-integration.js');
      createPaymentProcessor.mockReturnValue(mockProcessor);

      const response = await request(app)
        .post('/api/captain-cashout/create-intent')
        .send(validRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.clientSecret).toBe('pi_test_secret_123');
      expect(response.body.paymentIntentId).toBe('pi_test_123');
    });

    it('should handle invalid amount', async () => {
      const invalidRequest = { ...validRequest, amount: -10 };

      const response = await request(app)
        .post('/api/captain-cashout/create-intent')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid amount');
    });

    it('should handle missing required fields', async () => {
      const invalidRequest = { amount: 29.99 }; // Missing description

      const response = await request(app)
        .post('/api/captain-cashout/create-intent')
        .send(invalidRequest)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid amount');
    });

    it('should handle payment processor errors', async () => {
      const mockProcessor = {
        createPaymentIntent: vi.fn().mockRejectedValue(new Error('Stripe API error')),
      };

      const { createPaymentProcessor } = await import('../../server/stripe-integration.js');
      createPaymentProcessor.mockReturnValue(mockProcessor);

      const response = await request(app)
        .post('/api/captain-cashout/create-intent')
        .send(validRequest)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Payment intent creation failed');
    });
  });

  describe('Security', () => {
    it('should set security headers on captain-cashout page', async () => {
      const response = await request(app)
        .get('/captain-cashout')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['cache-control']).toBe('no-store');
    });

    it('should set security headers on success page', async () => {
      const response = await request(app)
        .get('/captain-cashout-success')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['cache-control']).toBe('no-store');
    });
  });
});
