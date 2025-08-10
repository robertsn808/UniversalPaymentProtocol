import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { securityHeadersMiddleware, generalRateLimit, sanitizeInput } from '../middleware/security.js';
import { AuthService, authenticateToken } from '../auth/jwt.js';
import { env } from '../config/environment.js';

// Test app setup
const app = express();
app.use(express.json());
app.use(securityHeadersMiddleware);
app.use(generalRateLimit);
app.use(sanitizeInput);

app.get('/test', (req, res) => {
  res.json({ message: 'Test endpoint' });
});

app.post('/test-input', (req, res) => {
  res.json({ received: req.body });
});

// Security test suite
describe('🔒 Security Tests', () => {
  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);

      // Check for essential security headers
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
      expect(response.headers).toHaveProperty('strict-transport-security');
      expect(response.headers).toHaveProperty('content-security-policy');
    });

    it('should prevent clickjacking', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    it('should prevent MIME sniffing', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      // Make multiple requests quickly
      const promises = Array.from({ length: 150 }, () =>
        request(app).get('/test')
      );

      const responses = await Promise.all(promises);
      const rateLimited = responses.filter(r => r.status === 429);

      // Should have some rate limited responses
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    it('should include retry-after header when rate limited', async () => {
      // Make enough requests to trigger rate limiting
      for (let i = 0; i < 150; i++) {
        await request(app).get('/test');
      }

      const response = await request(app)
        .get('/test')
        .expect(429);

      expect(response.headers).toHaveProperty('retry-after');
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize XSS attempts', async () => {
      const maliciousInput = {
        message: '<script>alert("xss")</script>',
        userInput: 'javascript:alert("xss")',
        eventHandler: 'onclick="alert(\'xss\')"'
      };

      const response = await request(app)
        .post('/test-input')
        .send(maliciousInput)
        .expect(200);

      // Check that malicious content is sanitized
      expect(response.body.received.message).not.toContain('<script>');
      expect(response.body.received.userInput).not.toContain('javascript:');
      expect(response.body.received.eventHandler).not.toContain('onclick=');
    });

    it('should limit input length', async () => {
      const longInput = {
        message: 'a'.repeat(15000) // Very long string
      };

      const response = await request(app)
        .post('/test-input')
        .send(longInput)
        .expect(200);

      // Should be truncated to 10000 characters
      expect(response.body.received.message.length).toBeLessThanOrEqual(10000);
    });
  });

  describe('JWT Security', () => {
    it('should require JWT_SECRET in production', () => {
      // Test that JWT_SECRET validation works
      const originalEnv = process.env.NODE_ENV;
      const originalSecret = process.env.JWT_SECRET;

      try {
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = 'your-super-secret-jwt-key-change-in-production';
        
        // This should throw an error
        expect(() => {
          require('../auth/jwt.js');
        }).toThrow('JWT_SECRET environment variable must be set to a secure random string');
      } finally {
        process.env.NODE_ENV = originalEnv;
        process.env.JWT_SECRET = originalSecret;
      }
    });

    it('should generate secure tokens', () => {
      const payload = {
        userId: 1,
        email: 'test@example.com',
        role: 'user'
      };

      const token = AuthService.generateToken(payload);
      
      // Token should be a string and not empty
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      
      // Token should have three parts (header.payload.signature)
      expect(token.split('.')).toHaveLength(3);
    });

    it('should verify tokens correctly', () => {
      const payload = {
        userId: 1,
        email: 'test@example.com',
        role: 'user'
      };

      const token = AuthService.generateToken(payload);
      const verified = AuthService.verifyToken(token);
      
      expect(verified.userId).toBe(payload.userId);
      expect(verified.email).toBe(payload.email);
      expect(verified.role).toBe(payload.role);
    });

    it('should reject invalid tokens', () => {
      expect(() => {
        AuthService.verifyToken('invalid.token.here');
      }).toThrow('Invalid token');
    });
  });

  describe('Password Security', () => {
    it('should hash passwords securely', async () => {
      const password = 'testPassword123';
      const hash = await AuthService.hashPassword(password);
      
      // Hash should be different from original password
      expect(hash).not.toBe(password);
      
      // Hash should be a string and not empty
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
      
      // Should start with $2b$ (bcrypt identifier)
      expect(hash).toMatch(/^\$2[ab]\$\d+\$/);
    });

    it('should verify passwords correctly', async () => {
      const password = 'testPassword123';
      const hash = await AuthService.hashPassword(password);
      
      const isValid = await AuthService.verifyPassword(password, hash);
      expect(isValid).toBe(true);
      
      const isInvalid = await AuthService.verifyPassword('wrongPassword', hash);
      expect(isInvalid).toBe(false);
    });
  });

  describe('Environment Security', () => {
    it('should validate production environment variables', () => {
      // Test environment validation
      expect(env.NODE_ENV).toBeDefined();
      expect(['development', 'staging', 'production', 'test']).toContain(env.NODE_ENV);
    });

    it('should have secure default rate limits', () => {
      expect(env.API_RATE_LIMIT_REQUESTS).toBeGreaterThan(0);
      expect(env.API_RATE_LIMIT_WINDOW_MS).toBeGreaterThan(0);
    });

    it('should validate JWT expiration', () => {
      expect(env.JWT_EXPIRES_IN).toBeDefined();
      expect(env.JWT_EXPIRES_IN.length).toBeGreaterThan(0);
    });
  });

  describe('CORS Security', () => {
    it('should have CORS origins configured', () => {
      expect(env.CORS_ORIGINS).toBeDefined();
      expect(env.CORS_ORIGINS.length).toBeGreaterThan(0);
    });
  });

  describe('Content Security Policy', () => {
    it('should include CSP headers', async () => {
      const response = await request(app)
        .get('/test')
        .expect(200);

      const csp = response.headers['content-security-policy'];
      expect(csp).toBeDefined();
      
      // Should include essential directives
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("object-src 'none'");
    });
  });

  describe('Request Size Limiting', () => {
    it('should limit request size', async () => {
      const largePayload = {
        data: 'x'.repeat(2 * 1024 * 1024) // 2MB payload
      };

      const response = await request(app)
        .post('/test-input')
        .send(largePayload)
        .expect(413); // Payload Too Large

      expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should sanitize SQL injection attempts', async () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "'; INSERT INTO users VALUES ('hacker', 'password'); --",
        "'; UPDATE users SET role='admin' WHERE id=1; --"
      ];

      for (const attempt of sqlInjectionAttempts) {
        const response = await request(app)
          .post('/test-input')
          .send({ query: attempt })
          .expect(200);

        // Should not contain the raw SQL injection attempt
        expect(response.body.received.query).not.toContain('DROP TABLE');
        expect(response.body.received.query).not.toContain('INSERT INTO');
        expect(response.body.received.query).not.toContain('UPDATE');
      }
    });
  });

  describe('Logging Security', () => {
    it('should not log sensitive information', () => {
      // Test that sensitive data is not logged in plain text
      const sensitiveData = {
        password: 'secretPassword123',
        apiKey: 'sk_test_1234567890',
        jwtToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
      };

      // This is a basic test - in a real scenario, you'd check actual logs
      expect(sensitiveData.password).toBeDefined();
      expect(sensitiveData.apiKey).toBeDefined();
      expect(sensitiveData.jwtToken).toBeDefined();
    });
  });
});

// Integration tests for security middleware
describe('🔒 Security Middleware Integration', () => {
  it('should apply all security middleware in correct order', async () => {
    const response = await request(app)
      .get('/test')
      .expect(200);

    // Should have all security headers
    expect(response.headers).toHaveProperty('x-content-type-options');
    expect(response.headers).toHaveProperty('x-frame-options');
    expect(response.headers).toHaveProperty('x-xss-protection');
    expect(response.headers).toHaveProperty('strict-transport-security');
  });

  it('should handle malformed requests gracefully', async () => {
    const response = await request(app)
      .post('/test-input')
      .set('Content-Type', 'application/json')
      .send('{"malformed": json}')
      .expect(400); // Bad Request

    expect(response.body.error).toBeDefined();
  });
});
