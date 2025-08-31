import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../server/index.js';

describe('Captain Cashout Basic Tests', () => {
  describe('GET /captain-cashout', () => {
    it('should return 200 for captain-cashout endpoint', async () => {
      const response = await request(app)
        .get('/captain-cashout')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/html');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
    });
  });

  describe('GET /captain-cashout-success', () => {
    it('should return 200 for success page endpoint', async () => {
      const response = await request(app)
        .get('/captain-cashout-success')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/html');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
    });
  });

  describe('POST /api/captain-cashout/create-intent', () => {
    it('should handle invalid amount', async () => {
      const response = await request(app)
        .post('/api/captain-cashout/create-intent')
        .send({ amount: -10 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid amount');
    });

    it('should handle missing required fields', async () => {
      const response = await request(app)
        .post('/api/captain-cashout/create-intent')
        .send({ amount: 29.99 })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle valid request structure', async () => {
      const response = await request(app)
        .post('/api/captain-cashout/create-intent')
        .send({
          amount: 29.99,
          description: 'Test payment',
          phoneNumber: '+1234567890',
          baseAmount: 29.99,
          processingFee: 0.90
        });

      // Should either succeed or fail gracefully
      expect(typeof response.body.success).toBe('boolean');
    });
  });

  describe('Security Headers', () => {
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
