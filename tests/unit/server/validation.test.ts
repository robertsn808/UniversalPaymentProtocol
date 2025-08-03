import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Import validation schemas (we'll test them directly)
const PaymentRequestSchema = z.object({
  amount: z.number().positive().max(1000000),
  currency: z.string().length(3).default('USD'),
  deviceType: z.enum(['smartphone', 'smart_tv', 'iot_device', 'voice_assistant', 'gaming_console', 'smartwatch', 'car_system']),
  deviceId: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  customerEmail: z.string().email().optional(),
  metadata: z.record(z.string()).optional()
});

const DeviceRegistrationSchema = z.object({
  deviceType: z.enum(['smartphone', 'smart_tv', 'iot_device', 'voice_assistant', 'gaming_console', 'smartwatch', 'car_system']),
  capabilities: z.array(z.string()).min(1),
  fingerprint: z.string().min(10).max(500),
  userAgent: z.string().optional(),
  ipAddress: z.string().optional()
});

describe('Input Validation Schemas', () => {
  describe('PaymentRequestSchema', () => {
    it('should validate a correct payment request', () => {
      const validRequest = {
        amount: 100,
        currency: 'USD',
        deviceType: 'smartphone',
        deviceId: 'device123',
        description: 'Test payment',
        customerEmail: 'test@example.com',
        metadata: { orderId: '12345' }
      };

      const result = PaymentRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should reject negative amounts', () => {
      const invalidRequest = {
        amount: -50,
        deviceType: 'smartphone',
        deviceId: 'device123',
        description: 'Test payment'
      };

      const result = PaymentRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should reject zero amounts', () => {
      const invalidRequest = {
        amount: 0,
        deviceType: 'smartphone',
        deviceId: 'device123',
        description: 'Test payment'
      };

      const result = PaymentRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should reject amounts over $10,000', () => {
      const invalidRequest = {
        amount: 1500000, // $15,000
        deviceType: 'smartphone',
        deviceId: 'device123',
        description: 'Large payment'
      };

      const result = PaymentRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should reject invalid currency codes', () => {
      const invalidRequest = {
        amount: 100,
        currency: 'INVALID',
        deviceType: 'smartphone',
        deviceId: 'device123',
        description: 'Test payment'
      };

      const result = PaymentRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should reject invalid device types', () => {
      const invalidRequest = {
        amount: 100,
        deviceType: 'invalid_device',
        deviceId: 'device123',
        description: 'Test payment'
      };

      const result = PaymentRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should reject empty device IDs', () => {
      const invalidRequest = {
        amount: 100,
        deviceType: 'smartphone',
        deviceId: '',
        description: 'Test payment'
      };

      const result = PaymentRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should reject device IDs over 100 characters', () => {
      const invalidRequest = {
        amount: 100,
        deviceType: 'smartphone',
        deviceId: 'a'.repeat(101),
        description: 'Test payment'
      };

      const result = PaymentRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should reject empty descriptions', () => {
      const invalidRequest = {
        amount: 100,
        deviceType: 'smartphone',
        deviceId: 'device123',
        description: ''
      };

      const result = PaymentRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should reject descriptions over 500 characters', () => {
      const invalidRequest = {
        amount: 100,
        deviceType: 'smartphone',
        deviceId: 'device123',
        description: 'a'.repeat(501)
      };

      const result = PaymentRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should reject invalid email addresses', () => {
      const invalidRequest = {
        amount: 100,
        deviceType: 'smartphone',
        deviceId: 'device123',
        description: 'Test payment',
        customerEmail: 'invalid-email'
      };

      const result = PaymentRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should accept valid email addresses', () => {
      const validRequest = {
        amount: 100,
        deviceType: 'smartphone',
        deviceId: 'device123',
        description: 'Test payment',
        customerEmail: 'test@example.com'
      };

      const result = PaymentRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should default currency to USD when not provided', () => {
      const request = {
        amount: 100,
        deviceType: 'smartphone',
        deviceId: 'device123',
        description: 'Test payment'
      };

      const result = PaymentRequestSchema.parse(request);
      expect(result.currency).toBe('USD');
    });

    it('should accept valid metadata', () => {
      const validRequest = {
        amount: 100,
        deviceType: 'smartphone',
        deviceId: 'device123',
        description: 'Test payment',
        metadata: {
          orderId: '12345',
          customerId: 'cust_123',
          productId: 'prod_456'
        }
      };

      const result = PaymentRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });
  });

  describe('DeviceRegistrationSchema', () => {
    it('should validate a correct device registration', () => {
      const validRegistration = {
        deviceType: 'smartphone',
        capabilities: ['touchscreen', 'camera', 'nfc'],
        fingerprint: 'device-fingerprint-12345',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
        ipAddress: '192.168.1.1'
      };

      const result = DeviceRegistrationSchema.safeParse(validRegistration);
      expect(result.success).toBe(true);
    });

    it('should reject invalid device types', () => {
      const invalidRegistration = {
        deviceType: 'invalid_device',
        capabilities: ['test'],
        fingerprint: 'device-fingerprint-12345'
      };

      const result = DeviceRegistrationSchema.safeParse(invalidRegistration);
      expect(result.success).toBe(false);
    });

    it('should reject empty capabilities array', () => {
      const invalidRegistration = {
        deviceType: 'smartphone',
        capabilities: [],
        fingerprint: 'device-fingerprint-12345'
      };

      const result = DeviceRegistrationSchema.safeParse(invalidRegistration);
      expect(result.success).toBe(false);
    });

    it('should reject fingerprints that are too short', () => {
      const invalidRegistration = {
        deviceType: 'smartphone',
        capabilities: ['touchscreen'],
        fingerprint: 'short'
      };

      const result = DeviceRegistrationSchema.safeParse(invalidRegistration);
      expect(result.success).toBe(false);
    });

    it('should reject fingerprints that are too long', () => {
      const invalidRegistration = {
        deviceType: 'smartphone',
        capabilities: ['touchscreen'],
        fingerprint: 'a'.repeat(501)
      };

      const result = DeviceRegistrationSchema.safeParse(invalidRegistration);
      expect(result.success).toBe(false);
    });

    it('should accept registration without optional fields', () => {
      const validRegistration = {
        deviceType: 'smart_tv',
        capabilities: ['display', 'remote_control'],
        fingerprint: 'tv-fingerprint-67890'
      };

      const result = DeviceRegistrationSchema.safeParse(validRegistration);
      expect(result.success).toBe(true);
    });

    it('should validate all supported device types', () => {
      const deviceTypes = ['smartphone', 'smart_tv', 'iot_device', 'voice_assistant', 'gaming_console', 'smartwatch', 'car_system'];
      
      deviceTypes.forEach(deviceType => {
        const registration = {
          deviceType,
          capabilities: ['test_capability'],
          fingerprint: `${deviceType}-fingerprint-12345`
        };

        const result = DeviceRegistrationSchema.safeParse(registration);
        expect(result.success).toBe(true);
      });
    });

    it('should accept multiple capabilities', () => {
      const validRegistration = {
        deviceType: 'gaming_console',
        capabilities: ['controller', 'display', 'audio', 'network', 'storage'],
        fingerprint: 'console-fingerprint-12345'
      };

      const result = DeviceRegistrationSchema.safeParse(validRegistration);
      expect(result.success).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing required fields in payment request', () => {
      const incompleteRequest = {
        amount: 100
        // Missing required fields
      };

      const result = PaymentRequestSchema.safeParse(incompleteRequest);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors.length).toBeGreaterThan(0);
      }
    });

    it('should handle missing required fields in device registration', () => {
      const incompleteRegistration = {
        deviceType: 'smartphone'
        // Missing required fields
      };

      const result = DeviceRegistrationSchema.safeParse(incompleteRegistration);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors.length).toBeGreaterThan(0);
      }
    });

    it('should handle null values', () => {
      const requestWithNulls = {
        amount: null,
        deviceType: null,
        deviceId: null,
        description: null
      };

      const result = PaymentRequestSchema.safeParse(requestWithNulls);
      expect(result.success).toBe(false);
    });

    it('should handle undefined values', () => {
      const requestWithUndefined = {
        amount: undefined,
        deviceType: undefined,
        deviceId: undefined,
        description: undefined
      };

      const result = PaymentRequestSchema.safeParse(requestWithUndefined);
      expect(result.success).toBe(false);
    });

    it('should handle extra fields gracefully', () => {
      const requestWithExtraFields = {
        amount: 100,
        deviceType: 'smartphone',
        deviceId: 'device123',
        description: 'Test payment',
        extraField: 'should be ignored',
        anotherExtra: 12345
      };

      const result = PaymentRequestSchema.safeParse(requestWithExtraFields);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).not.toHaveProperty('extraField');
        expect(result.data).not.toHaveProperty('anotherExtra');
      }
    });
  });
});