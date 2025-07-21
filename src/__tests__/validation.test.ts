// Validation utilities tests
import { describe, it, expect } from 'vitest';
import { 
  PaymentRequestSchema, 
  DeviceRegistrationSchema, 
  validateInput,
  sanitizeString,
  sanitizeAmount,
  sanitizeDeviceId,
  ValidationPatterns
} from '../utils/validation';

describe('Validation Utils', () => {
  describe('PaymentRequestSchema', () => {
    it('should validate correct payment request', () => {
      const validRequest = testUtils.createMockPaymentRequest();
      const result = validateInput(PaymentRequestSchema, validRequest);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amount).toBe(25.99);
        expect(result.data.deviceType).toBe('smartphone');
      }
    });

    it('should reject invalid payment request', () => {
      const invalidRequest = {
        amount: -10,
        deviceType: '',
        deviceId: '',
        description: ''
      };
      
      const result = validateInput(PaymentRequestSchema, invalidRequest);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toHaveLength(4);
        expect(result.errors[0]).toContain('Amount must be greater than 0');
      }
    });
  });

  describe('DeviceRegistrationSchema', () => {
    it('should validate correct device registration', () => {
      const validRegistration = testUtils.createMockDeviceRegistration();
      const result = validateInput(DeviceRegistrationSchema, validRegistration);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.deviceType).toBe('smartphone');
        expect(result.data.capabilities.internet_connection).toBe(true);
      }
    });

    it('should reject invalid device registration', () => {
      const invalidRegistration = {
        deviceType: '',
        capabilities: { internet_connection: 'not_boolean' },
        fingerprint: ''
      };
      
      const result = validateInput(DeviceRegistrationSchema, invalidRegistration);
      expect(result.success).toBe(false);
    });
  });

  describe('Sanitization functions', () => {
    it('should sanitize strings', () => {
      expect(sanitizeString('  <script>alert("xss")</script>  ')).toBe('scriptalert(xss)/script');
      expect(sanitizeString('normal text')).toBe('normal text');
    });

    it('should sanitize amounts', () => {
      expect(sanitizeAmount(25.999)).toBe(26);
      expect(sanitizeAmount(25.994)).toBe(25.99);
      expect(sanitizeAmount(25)).toBe(25);
    });

    it('should sanitize device IDs', () => {
      expect(sanitizeDeviceId('device@123#$%')).toBe('device123');
      expect(sanitizeDeviceId('valid_device-123')).toBe('valid_device-123');
    });
  });

  describe('Validation patterns', () => {
    it('should validate device ID pattern', () => {
      expect(ValidationPatterns.deviceId.test('valid_device-123')).toBe(true);
      expect(ValidationPatterns.deviceId.test('invalid@device')).toBe(false);
    });

    it('should validate currency pattern', () => {
      expect(ValidationPatterns.currency.test('USD')).toBe(true);
      expect(ValidationPatterns.currency.test('usd')).toBe(false);
      expect(ValidationPatterns.currency.test('INVALID')).toBe(false);
    });

    it('should validate email pattern', () => {
      expect(ValidationPatterns.email.test('test@example.com')).toBe(true);
      expect(ValidationPatterns.email.test('invalid-email')).toBe(false);
    });
  });
});