import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../server/index.js';

describe('UPP Server Integration Tests', () => {
  beforeAll(async () => {
    // Wait for server to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  describe('System Endpoints', () => {
    it('should return system status on GET /', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body).toMatchObject({
        name: 'Universal Payment Protocol',
        version: '2.0.0',
        status: 'operational',
        services: {
          device_adapters: expect.any(Array),
          security_enabled: true,
          multi_currency: true
        },
        endpoints: expect.any(Object)
      });
    });

    it('should return health check on GET /health', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        memory: expect.any(Object),
        services: expect.any(Object)
      });
    });

    it('should return metrics on GET /metrics', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      expect(response.body).toMatchObject({
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        memory: expect.any(Object),
        cpu: expect.any(Object),
        supportedDevices: expect.any(Number),
        supportedCurrencies: expect.any(Number),
        version: '2.0.0'
      });
    });
  });

  describe('Device Registration', () => {
    it('should register a valid smartphone device', async () => {
      const deviceData = {
        deviceType: 'smartphone',
        capabilities: ['touchscreen', 'camera', 'nfc'],
        fingerprint: 'test-smartphone-fingerprint-12345',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)'
      };

      const response = await request(app)
        .post('/api/v1/devices/register')
        .send(deviceData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        deviceId: expect.stringMatching(/^smartphone_\d+_/),
        deviceType: 'smartphone',
        supportedCapabilities: expect.any(Array),
        trustScore: expect.any(Number),
        expiresAt: expect.any(String),
        message: 'Device registered successfully'
      });
    });

    it('should register a valid smart TV device', async () => {
      const deviceData = {
        deviceType: 'smart_tv',
        capabilities: ['display', 'remote_control', 'wifi'],
        fingerprint: 'test-smarttv-fingerprint-67890'
      };

      const response = await request(app)
        .post('/api/v1/devices/register')
        .send(deviceData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        deviceId: expect.stringMatching(/^smart_tv_\d+_/),
        deviceType: 'smart_tv',
        supportedCapabilities: expect.arrayContaining(['qr_code_display'])
      });
    });

    it('should reject invalid device type', async () => {
      const deviceData = {
        deviceType: 'invalid_device',
        capabilities: ['test'],
        fingerprint: 'test-fingerprint'
      };

      const response = await request(app)
        .post('/api/v1/devices/register')
        .send(deviceData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Validation failed'
      });
    });

    it('should reject missing capabilities', async () => {
      const deviceData = {
        deviceType: 'smartphone',
        capabilities: [],
        fingerprint: 'test-fingerprint'
      };

      const response = await request(app)
        .post('/api/v1/devices/register')
        .send(deviceData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Validation failed'
      });
    });
  });

  describe('Device Capabilities', () => {
    it('should return capabilities for smartphone', async () => {
      const response = await request(app)
        .get('/api/v1/devices/smartphone/capabilities')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        deviceType: 'smartphone',
        capabilities: expect.arrayContaining(['touchscreen', 'biometric_auth'])
      });
    });

    it('should return capabilities for smart TV', async () => {
      const response = await request(app)
        .get('/api/v1/devices/smart_tv/capabilities')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        deviceType: 'smart_tv',
        capabilities: expect.arrayContaining(['qr_code_display', 'remote_control'])
      });
    });

    it('should return 404 for unknown device type', async () => {
      const response = await request(app)
        .get('/api/v1/devices/unknown_device/capabilities')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Device type not found'
      });
    });
  });

  describe('Currency Support', () => {
    it('should return supported currencies', async () => {
      const response = await request(app)
        .get('/api/v1/currencies/supported')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        currencies: expect.arrayContaining(['USD', 'EUR', 'GBP']),
        baseCurrency: 'USD',
        lastUpdated: expect.any(String)
      });
    });
  });

  describe('Payment Processing', () => {
    it('should validate payment request with valid data', async () => {
      const paymentData = {
        amount: 100,
        currency: 'USD',
        deviceType: 'smartphone',
        deviceId: 'test-device-123',
        description: 'Test payment',
        customerEmail: 'test@example.com'
      };

      // Note: This will fail due to Stripe not being configured in test environment
      // but it should validate the input and reach the Stripe error
      const response = await request(app)
        .post('/api/v1/payments/process')
        .send(paymentData)
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.any(String)
      });
    });

    it('should reject payment with invalid amount', async () => {
      const paymentData = {
        amount: -50,
        currency: 'USD',
        deviceType: 'smartphone',
        deviceId: 'test-device-123',
        description: 'Test payment'
      };

      const response = await request(app)
        .post('/api/v1/payments/process')
        .send(paymentData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Validation failed'
      });
    });

    it('should reject payment with invalid device type', async () => {
      const paymentData = {
        amount: 100,
        currency: 'USD',
        deviceType: 'invalid_device',
        deviceId: 'test-device-123',
        description: 'Test payment'
      };

      const response = await request(app)
        .post('/api/v1/payments/process')
        .send(paymentData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Validation failed'
      });
    });

    it('should reject payment with amount over limit', async () => {
      const paymentData = {
        amount: 1500000, // Over $10,000 limit
        currency: 'USD',
        deviceType: 'smartphone',
        deviceId: 'test-device-123',
        description: 'Large payment'
      };

      const response = await request(app)
        .post('/api/v1/payments/process')
        .send(paymentData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Validation failed'
      });
    });

    it('should reject payment with invalid email', async () => {
      const paymentData = {
        amount: 100,
        currency: 'USD',
        deviceType: 'smartphone',
        deviceId: 'test-device-123',
        description: 'Test payment',
        customerEmail: 'invalid-email'
      };

      const response = await request(app)
        .post('/api/v1/payments/process')
        .send(paymentData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Validation failed'
      });
    });
  });

  describe('Security Features', () => {
    it('should reject malformed JSON', async () => {
      const response = await request(app)
        .post('/api/v1/payments/process')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid JSON'
      });
    });

    it('should handle CORS headers', async () => {
      const response = await request(app)
        .options('/api/v1/payments/process')
        .expect(204);

      expect(response.headers).toHaveProperty('access-control-allow-methods');
    });

    it('should include security headers', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown endpoints', async () => {
      const response = await request(app)
        .get('/api/unknown/endpoint')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Endpoint not found',
        availableEndpoints: expect.any(Array)
      });
    });

    it('should handle POST to non-existent endpoint', async () => {
      const response = await request(app)
        .post('/api/unknown/endpoint')
        .send({ data: 'test' })
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Endpoint not found'
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      // Make a few requests to ensure they're allowed
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .get('/health')
          .expect(200);

        expect(response.headers).toHaveProperty('x-ratelimit-limit');
        expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      }
    });
  });
});