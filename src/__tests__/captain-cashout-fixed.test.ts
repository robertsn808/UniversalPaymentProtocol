import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createServer } from '../../server/index.js';
import { createPaymentProcessor } from '../../server/stripe-integration.js';

// Mock the payment processor
vi.mock('../../server/stripe-integration.js', () => ({
  createPaymentProcessor: vi.fn()
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
  let app: express.Application;
  let server: any;
  let mockPaymentProcessor: any;

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock payment processor
    mockPaymentProcessor = {
      createPaymentIntent: vi.fn(),
      createCheckoutSession: vi.fn(),
      processDevicePayment: vi.fn()
    };

    // Mock the factory function
    vi.mocked(createPaymentProcessor).mockReturnValue(mockPaymentProcessor);

    // Mock file operations
    const { SecureFileHandler } = await import('../../src/utils/file-security.js');
    SecureFileHandler.fileExistsSecurely.mockResolvedValue(true);
    SecureFileHandler.readFileSecurely.mockResolvedValue('<html>Mock HTML</html>');
    SecureFileHandler.getFileInfoSecurely.mockReturnValue({
      exists: true,
      size: 100,
      extension: '.html',
      lastModified: new Date(),
    });

    // Create test server
    server = await createServer();
    app = server.app;
  });

  afterEach(async () => {
    if (server && server.close) {
      await server.close();
    }
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
      const { SecureFileHandler } = await import('../../src/utils/file-security.js');
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
      const mockIntent = {
        id: 'pi_test_123',
        client_secret: 'pi_test_secret_123',
        amount: 2999,
        currency: 'usd',
        status: 'requires_payment_method'
      };

      mockPaymentProcessor.createPaymentIntent.mockResolvedValue(mockIntent);

      const response = await request(app)
        .post('/api/captain-cashout/create-intent')
        .send(validRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.clientSecret).toBe('pi_test_secret_123');
      expect(response.body.paymentIntentId).toBe('pi_test_123');

      expect(mockPaymentProcessor.createPaymentIntent).toHaveBeenCalledWith({
        amount: 29.99,
        currency: 'usd',
        description: 'Captain Cashout - Test payment',
        metadata: expect.objectContaining({
          service: 'captain_cashout_platform',
          base_amount: '29.99',
          processing_fee: '0.90',
          phone_number: '+1234567890',
        })
      });
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
      mockPaymentProcessor.createPaymentIntent.mockRejectedValue(
        new Error('Stripe API error')
      );

      const response = await request(app)
        .post('/api/captain-cashout/create-intent')
        .send(validRequest)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Payment intent creation failed');
    });

    it('should handle rate limiting', async () => {
      mockPaymentProcessor.createPaymentIntent.mockResolvedValue({
        id: 'pi_test_123',
        client_secret: 'pi_test_secret_123',
      });

      // Make multiple requests to trigger rate limit
      const requests = Array(15).fill().map(() =>
        request(app)
          .post('/api/captain-cashout/create-intent')
          .send(validRequest)
      );

      const responses = await Promise.all(requests);

      // At least one should be rate limited (429)
      const rateLimitedResponse = responses.find(r => r.status === 429);
      expect(rateLimitedResponse).toBeDefined();
    });
  });

  describe('Stripe Integration', () => {
    describe('createPaymentIntent', () => {
      it('should create payment intent with correct parameters', async () => {
        const mockIntent = {
          id: 'pi_test_456',
          client_secret: 'pi_test_secret_456',
          amount: 5000,
          currency: 'usd'
        };

        mockPaymentProcessor.createPaymentIntent.mockResolvedValue(mockIntent);

        const params = {
          amount: 50,
          currency: 'usd',
          description: 'Test intent',
          metadata: { test: 'metadata' }
        };

        const result = await mockPaymentProcessor.createPaymentIntent(params);

        expect(result).toEqual(mockIntent);
        expect(mockPaymentProcessor.createPaymentIntent).toHaveBeenCalledWith(params);
      });

      it('should handle Stripe API errors', async () => {
        mockPaymentProcessor.createPaymentIntent.mockRejectedValue(
          new Error('Invalid API key')
        );

        const params = {
          amount: 50,
          currency: 'usd',
          description: 'Test intent'
        };

        await expect(mockPaymentProcessor.createPaymentIntent(params))
          .rejects.toThrow('Invalid API key');
      });
    });

    describe('createCheckoutSession', () => {
      it('should create checkout session successfully', async () => {
        const mockSession = {
          id: 'cs_test_123',
          url: 'https://checkout.stripe.com/pay/cs_test_123',
          payment_intent: 'pi_test_123'
        };

        mockPaymentProcessor.createCheckoutSession.mockResolvedValue(mockSession);

        const params = {
          amount: 100,
          currency: 'usd',
          description: 'Test checkout',
          customerEmail: 'test@example.com',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
          metadata: { service: 'captain_cashout' }
        };

        const result = await mockPaymentProcessor.createCheckoutSession(params);

        expect(result).toEqual(mockSession);
        expect(mockPaymentProcessor.createCheckoutSession).toHaveBeenCalledWith(params);
      });

      it('should handle checkout session creation errors', async () => {
        mockPaymentProcessor.createCheckoutSession.mockRejectedValue(
          new Error('Invalid amount')
        );

        const params = {
          amount: -50,
          currency: 'usd',
          description: 'Invalid checkout'
        };

        await expect(mockPaymentProcessor.createCheckoutSession(params))
          .rejects.toThrow('Invalid amount');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON in payment intent request', async () => {
      const response = await request(app)
        .post('/api/captain-cashout/create-intent')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should handle missing payment processor', async () => {
      vi.mocked(createPaymentProcessor).mockReturnValue(null);

      const response = await request(app)
        .post('/api/captain-cashout/create-intent')
        .send({
          amount: 29.99,
          description: 'Test payment'
        })
        .expect(500);

      expect(response.body.error).toBe('Payment processor not available');
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
