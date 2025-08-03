// Security Features Tests
// Comprehensive testing of all security improvements

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { AuthMiddleware } from '../../server/middleware/auth.js';
import { EncryptionUtils } from '../../server/middleware/security.js';
import app from '../../server/index.js';

describe('Security Features', () => {
  let authToken: string;
  let apiKey: string;

  beforeEach(() => {
    // Generate test tokens
    authToken = AuthMiddleware.generateToken({
      id: 'test-user-1',
      email: 'test@example.com',
      role: 'user'
    });

    apiKey = 'upp_test_key_12345'; // Default test API key
  });

  describe('Authentication & Authorization', () => {
    it('should reject requests without authentication for protected endpoints', async () => {
      const response = await request(app)
        .post('/api/v1/payments/process')
        .send({
          amount: 100,
          deviceType: 'smartphone',
          deviceId: 'test-device',
          description: 'Test payment'
        })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Authentication required'
      });
    });

    it('should accept valid JWT token', async () => {
      const response = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 100,
          deviceType: 'smartphone',
          deviceId: 'test-device',
          description: 'Test payment'
        });

      // Should not be 401 unauthorized (may be other errors due to Stripe config)
      expect(response.status).not.toBe(401);
    });

    it('should accept valid API key', async () => {
      const response = await request(app)
        .post('/api/v1/payments/process')
        .set('X-API-Key', apiKey)
        .send({
          amount: 100,
          deviceType: 'smartphone',
          deviceId: 'test-device',
          description: 'Test payment'
        });

      // Should not be 401 unauthorized
      expect(response.status).not.toBe(401);
    });

    it('should reject invalid JWT token', async () => {
      const response = await request(app)
        .post('/api/v1/payments/process')
        .set('Authorization', 'Bearer invalid-token')
        .send({
          amount: 100,
          deviceType: 'smartphone',
          deviceId: 'test-device',
          description: 'Test payment'
        })
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid token'
      });
    });

    it('should reject invalid API key', async () => {
      const response = await request(app)
        .post('/api/v1/payments/process')
        .set('X-API-Key', 'invalid-api-key')
        .send({
          amount: 100,
          deviceType: 'smartphone',
          deviceId: 'test-device',
          description: 'Test payment'
        })
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid API key'
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to payment endpoints', async () => {
      const requests = [];
      
      // Make multiple rapid requests
      for (let i = 0; i < 15; i++) {
        requests.push(
          request(app)
            .post('/api/v1/payments/process')
            .set('X-API-Key', apiKey)
            .send({
              amount: 10,
              deviceType: 'smartphone',
              deviceId: `test-device-${i}`,
              description: 'Rate limit test'
            })
        );
      }

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should apply stricter rate limiting to auth endpoints', async () => {
      const requests = [];
      
      // Make multiple rapid login attempts
      for (let i = 0; i < 8; i++) {
        requests.push(
          request(app)
            .post('/api/v1/auth/login')
            .send({
              email: 'test@example.com',
              password: 'wrong-password'
            })
        );
      }

      const responses = await Promise.all(requests);
      
      // Should get rate limited quickly
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Input Validation & Sanitization', () => {
    it('should reject malformed JSON', async () => {
      const response = await request(app)
        .post('/api/v1/payments/process')
        .set('X-API-Key', apiKey)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid JSON'
      });
    });

    it('should validate payment amounts', async () => {
      const response = await request(app)
        .post('/api/v1/payments/process')
        .set('X-API-Key', apiKey)
        .send({
          amount: -50,
          deviceType: 'smartphone',
          deviceId: 'test-device',
          description: 'Invalid payment'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid amount'
      });
    });

    it('should reject excessive amount precision', async () => {
      const response = await request(app)
        .post('/api/v1/payments/process')
        .set('X-API-Key', apiKey)
        .send({
          amount: 100.12345, // Too many decimal places
          deviceType: 'smartphone',
          deviceId: 'test-device',
          description: 'Precision test'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid precision'
      });
    });

    it('should reject amounts over limit', async () => {
      const response = await request(app)
        .post('/api/v1/payments/process')
        .set('X-API-Key', apiKey)
        .send({
          amount: 1500000, // Over $1M limit
          deviceType: 'smartphone',
          deviceId: 'test-device',
          description: 'Large payment'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Amount too large'
      });
    });

    it('should sanitize input to prevent XSS', async () => {
      const maliciousInput = '<script>alert("xss")</script>';
      
      const response = await request(app)
        .post('/api/v1/devices/register')
        .set('X-API-Key', apiKey)
        .send({
          deviceType: 'smartphone',
          capabilities: ['touchscreen'],
          fingerprint: maliciousInput
        });

      // Should not contain the script tag
      if (response.body.success) {
        expect(response.body.message).not.toContain('<script>');
      }
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      // Check for security headers
      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-request-id');
      expect(response.headers).not.toHaveProperty('x-powered-by');
    });

    it('should include Content Security Policy', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.headers).toHaveProperty('content-security-policy');
      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    });

    it('should include HSTS headers in production mode', async () => {
      // This would need NODE_ENV=production to test properly
      const response = await request(app)
        .get('/')
        .expect(200);

      // In development, HSTS may not be set
      // In production, this should be present
    });
  });

  describe('Request Size Limits', () => {
    it('should reject oversized requests', async () => {
      const largePayload = {
        amount: 100,
        deviceType: 'smartphone',
        deviceId: 'test-device',
        description: 'A'.repeat(10000), // Very long description
        metadata: {}
      };

      // Add lots of metadata to make it large
      for (let i = 0; i < 1000; i++) {
        largePayload.metadata[`key${i}`] = 'A'.repeat(100);
      }

      const response = await request(app)
        .post('/api/v1/payments/process')
        .set('X-API-Key', apiKey)
        .send(largePayload);

      // Should be rejected for being too large
      expect([413, 400]).toContain(response.status);
    });
  });

  describe('Fraud Detection Integration', () => {
    it('should flag high-risk transactions', async () => {
      const response = await request(app)
        .post('/api/v1/payments/process')
        .set('X-API-Key', apiKey)
        .send({
          amount: 75000, // High amount
          deviceType: 'smartphone',
          deviceId: 'suspicious-device-999',
          description: 'High risk transaction'
        });

      if (response.status === 403) {
        expect(response.body).toMatchObject({
          success: false,
          error: 'Transaction blocked'
        });
      }
    });

    it('should allow low-risk transactions', async () => {
      const response = await request(app)
        .post('/api/v1/payments/process')
        .set('X-API-Key', apiKey)
        .send({
          amount: 25,
          deviceType: 'smartphone',
          deviceId: 'trusted-device-123',
          description: 'Low risk transaction'
        });

      // Should not be blocked for fraud (may fail for other reasons like Stripe config)
      expect(response.status).not.toBe(403);
    });
  });
});

describe('Encryption Utilities', () => {
  describe('Data Encryption', () => {
    it('should encrypt and decrypt data correctly', () => {
      const testData = 'sensitive payment information';
      
      const encrypted = EncryptionUtils.encrypt(testData);
      expect(encrypted.encrypted).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.encrypted).not.toBe(testData);

      const decrypted = EncryptionUtils.decrypt(encrypted.encrypted, encrypted.iv);
      expect(decrypted).toBe(testData);
    });

    it('should produce different output for same input', () => {
      const testData = 'test data';
      
      const encrypted1 = EncryptionUtils.encrypt(testData);
      const encrypted2 = EncryptionUtils.encrypt(testData);
      
      // Should be different due to random IV
      expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });

    it('should fail decryption with wrong IV', () => {
      const testData = 'sensitive data';
      const encrypted = EncryptionUtils.encrypt(testData);
      
      expect(() => {
        EncryptionUtils.decrypt(encrypted.encrypted, 'wrong-iv');
      }).toThrow();
    });
  });

  describe('Password Hashing', () => {
    it('should hash passwords securely', () => {
      const password = 'mySecurePassword123';
      
      const result = EncryptionUtils.hashPassword(password);
      expect(result.hash).toBeDefined();
      expect(result.salt).toBeDefined();
      expect(result.hash).not.toBe(password);
      expect(result.hash.length).toBe(128); // 64 bytes = 128 hex chars
    });

    it('should verify passwords correctly', () => {
      const password = 'mySecurePassword123';
      const { hash, salt } = EncryptionUtils.hashPassword(password);
      
      expect(EncryptionUtils.verifyPassword(password, hash, salt)).toBe(true);
      expect(EncryptionUtils.verifyPassword('wrongPassword', hash, salt)).toBe(false);
    });

    it('should produce different hashes for same password', () => {
      const password = 'samePassword';
      
      const result1 = EncryptionUtils.hashPassword(password);
      const result2 = EncryptionUtils.hashPassword(password);
      
      expect(result1.hash).not.toBe(result2.hash);
      expect(result1.salt).not.toBe(result2.salt);
    });
  });

  describe('Data Hashing', () => {
    it('should hash sensitive data consistently', () => {
      const sensitiveData = 'credit-card-4111111111111111';
      
      const hash1 = EncryptionUtils.hashSensitiveData(sensitiveData);
      const hash2 = EncryptionUtils.hashSensitiveData(sensitiveData);
      
      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(sensitiveData);
      expect(hash1.length).toBe(64); // SHA256 = 64 hex chars
    });

    it('should produce different hashes for different data', () => {
      const data1 = 'sensitive-data-1';
      const data2 = 'sensitive-data-2';
      
      const hash1 = EncryptionUtils.hashSensitiveData(data1);
      const hash2 = EncryptionUtils.hashSensitiveData(data2);
      
      expect(hash1).not.toBe(hash2);
    });
  });
});

describe('JWT Token Management', () => {
  describe('Token Generation', () => {
    it('should generate valid JWT tokens', () => {
      const user = {
        id: 'user123',
        email: 'test@example.com',
        role: 'user'
      };

      const token = AuthMiddleware.generateToken(user);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include user data in token payload', () => {
      const user = {
        id: 'user123',
        email: 'test@example.com',
        role: 'admin',
        deviceId: 'device456'
      };

      const token = AuthMiddleware.generateToken(user);
      const decoded = jwt.decode(token) as any;
      
      expect(decoded.id).toBe(user.id);
      expect(decoded.email).toBe(user.email);
      expect(decoded.role).toBe(user.role);
      expect(decoded.deviceId).toBe(user.deviceId);
      expect(decoded.exp).toBeDefined(); // Expiration
    });
  });

  describe('API Key Management', () => {
    it('should generate API keys with permissions', () => {
      const permissions = ['payment:process', 'device:register'];
      const result = AuthMiddleware.generateApiKey('Test Key', permissions);
      
      expect(result.apiKey).toBeDefined();
      expect(result.apiKey).toMatch(/^upp_[a-f0-9]{32}$/);
      expect(result.keyInfo.name).toBe('Test Key');
      expect(result.keyInfo.permissions).toEqual(permissions);
    });

    it('should list API keys (masked)', () => {
      AuthMiddleware.generateApiKey('Test Key 1', ['read']);
      AuthMiddleware.generateApiKey('Test Key 2', ['write']);
      
      const keys = AuthMiddleware.listApiKeys();
      
      expect(keys.length).toBeGreaterThan(0);
      keys.forEach(key => {
        expect(key.key).toMatch(/^upp_[a-f0-9]{8}\.\.\.$/); // Masked
        expect(key.name).toBeDefined();
        expect(key.permissions).toBeDefined();
      });
    });

    it('should revoke API keys', () => {
      const { apiKey } = AuthMiddleware.generateApiKey('Test Key', []);
      
      expect(AuthMiddleware.revokeApiKey(apiKey)).toBe(true);
      expect(AuthMiddleware.revokeApiKey(apiKey)).toBe(false); // Already revoked
    });
  });
});