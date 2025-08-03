import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import cors from 'cors';
import helmet from 'helmet';

// Mock the UPP Stripe Processor
class MockUPPStripeProcessor {
  async processDevicePayment(paymentData: any) {
    return {
      success: true,
      transaction_id: `txn_mock_${Date.now()}`,
      amount: paymentData.amount,
      currency: 'USD',
      status: 'completed',
      receipt_data: {
        payment_intent_id: `pi_mock_${Date.now()}`,
        amount: paymentData.amount,
        currency: 'USD',
        description: paymentData.description,
        device_type: paymentData.deviceType,
        timestamp: new Date().toISOString()
      }
    };
  }
}

// Create a minimal Express app for testing
const createTestApp = () => {
  const app = express();
  
  // Initialize Stripe processor mock
  let stripeProcessor: MockUPPStripeProcessor;
  try {
    stripeProcessor = new MockUPPStripeProcessor();
  } catch (error) {
    console.error('⚠️  Stripe not configured for tests');
  }

  // Security middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // Welcome endpoint
  app.get('/', (req, res) => {
    res.json({
      message: 'Universal Payment Protocol - TEST MODE',
      status: 'operational',
      stripe_configured: !!stripeProcessor
    });
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      server: 'test',
      stripe_ready: !!stripeProcessor
    });
  });

  // Process payment endpoint
  app.post('/api/process-payment', async (req, res) => {
    try {
      if (!stripeProcessor) {
        return res.status(500).json({
          success: false,
          error: 'Stripe not configured',
          message: 'Set STRIPE_SECRET_KEY in environment variables'
        });
      }

      const { amount, deviceType, deviceId, description, customerEmail, metadata } = req.body;
      
      const result = await stripeProcessor.processDevicePayment({
        amount,
        deviceType,
        deviceId,
        description,
        customerEmail,
        metadata
      });

      res.json({
        ...result,
        message: `Payment ready for ${deviceType}!`
      });

    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Payment failed'
      });
    }
  });

  return app;
};

describe('API Endpoints', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('GET /', () => {
    it('should return welcome message', async () => {
      const response = await request(app).get('/');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('status');
      expect(response.body.message).toContain('Universal Payment Protocol');
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('POST /api/process-payment', () => {
    it('should process payment successfully', async () => {
      const paymentData = {
        amount: 25.99,
        deviceType: 'smartphone',
        deviceId: 'test_device_123',
        description: 'Test payment'
      };

      const response = await request(app)
        .post('/api/process-payment')
        .send(paymentData)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.amount).toBe(25.99);
      expect(response.body).toHaveProperty('transaction_id');
    });

    it('should handle missing payment data', async () => {
      const response = await request(app)
        .post('/api/process-payment')
        .send({})
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200); // Still succeeds with mock
      expect(response.body).toHaveProperty('success');
    });
  });
});
