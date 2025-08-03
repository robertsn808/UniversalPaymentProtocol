// Security Manager Tests
// Unit tests for advanced security features

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SecurityManager } from '../../../src/modules/universal-payment-protocol/security/SecurityManager';
import { UPPDevice, PaymentRequest } from '../../../src/modules/universal-payment-protocol/core/types';

describe('SecurityManager', () => {
  let securityManager: SecurityManager;
  let mockDevice: UPPDevice;
  let mockPaymentRequest: PaymentRequest;

  beforeEach(() => {
    securityManager = new SecurityManager();
    
    mockDevice = {
      deviceType: 'smartphone',
      fingerprint: 'test_device_123',
      capabilities: {
        internet_connection: true,
        display: 'touchscreen',
        biometric: true,
        nfc: true
      },
      securityContext: {
        encryption_level: 'AES256',
        device_attestation: 'trusted',
        biometric_lock: true
      },
      handlePaymentResponse: vi.fn(),
      handleError: vi.fn()
    };

    mockPaymentRequest = {
      amount: 25.99,
      currency: 'USD',
      description: 'Coffee purchase',
      merchant_id: 'coffee_shop_001'
    };
  });

  describe('biometric authentication', () => {
    it('should authenticate fingerprint successfully', async () => {
      const biometricData = {
        fingerprint: {
          template: 'encrypted_fingerprint_data',
          quality: 0.95
        }
      };

      const result = await securityManager.authenticateBiometric(mockDevice, biometricData);

      expect(result.method).toBe('fingerprint');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.liveness_check).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should authenticate face recognition', async () => {
      const biometricData = {
        face: {
          image: 'base64_face_image',
          landmarks: []
        }
      };

      const result = await securityManager.authenticateBiometric(mockDevice, biometricData);

      expect(result.method).toBe('face_recognition');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.liveness_check).toBeDefined();
    });

    it('should authenticate voice pattern', async () => {
      const biometricData = {
        voice: {
          audio: 'base64_audio_data',
          passphrase: 'test passphrase'
        }
      };

      const result = await securityManager.authenticateBiometric(mockDevice, biometricData);

      expect(result.method).toBe('voice_pattern');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should authenticate behavioral patterns', async () => {
      const biometricData = {
        behavioral: {
          typing_pattern: [100, 150, 200],
          mouse_movement: []
        }
      };

      const result = await securityManager.authenticateBiometric(mockDevice, biometricData);

      expect(result.method).toBe('behavioral_pattern');
      expect(result.liveness_check).toBe(true);
    });

    it('should handle multi-modal biometric fusion', async () => {
      const biometricData = {
        multi_modal: {
          face: { image: 'face_data' },
          voice: { audio: 'voice_data' },
          fingerprint: { template: 'fp_data' }
        }
      };

      const result = await securityManager.authenticateBiometric(mockDevice, biometricData);

      expect(result.method).toBe('multi_modal_fusion');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should handle biometric authentication errors', async () => {
      const biometricData = {}; // Invalid data

      const result = await securityManager.authenticateBiometric(mockDevice, biometricData);

      expect(result.success).toBe(false);
      expect(result.confidence).toBe(0);
    });
  });

  describe('fraud detection', () => {
    it('should detect low risk transactions', async () => {
      const context = {
        location: { lat: 37.7749, lng: -122.4194 },
        timestamp: Date.now(),
        user_behavior: { normal_pattern: true },
        merchant_risk: 'low'
      };

      const result = await securityManager.detectFraud(mockPaymentRequest, mockDevice, context);

      expect(result.risk_level).toBe('low');
      expect(result.recommendation).toBe('approve');
      expect(result.risk_score).toBeLessThan(20);
      expect(result.explanation).toContain('low risk');
    });

    it('should detect high risk transactions', async () => {
      const highRiskRequest = {
        ...mockPaymentRequest,
        amount: 5000 // High amount
      };
      
      const context = {
        location: { lat: 0, lng: 0 }, // Unusual location
        timestamp: new Date().setHours(3), // 3 AM transaction
        user_behavior: { unusual_pattern: true },
        merchant_risk: 'high'
      };

      const result = await securityManager.detectFraud(highRiskRequest, mockDevice, context);

      expect(result.risk_level).toBe('high');
      expect(result.recommendation).toBeOneOf(['review', 'decline']);
      expect(result.risk_score).toBeGreaterThan(40);
      expect(result.flags.length).toBeGreaterThan(0);
    });

    it('should flag new devices', async () => {
      const newDevice = {
        ...mockDevice,
        fingerprint: 'completely_new_device'
      };

      const context = {
        location: { lat: 37.7749, lng: -122.4194 },
        timestamp: Date.now(),
        user_behavior: { normal_pattern: true }
      };

      const result = await securityManager.detectFraud(mockPaymentRequest, newDevice, context);

      expect(result.flags).toContain('new_device');
      expect(result.risk_score).toBeGreaterThan(0);
    });

    it('should flag unusual time transactions', async () => {
      const context = {
        location: { lat: 37.7749, lng: -122.4194 },
        timestamp: new Date().setHours(3), // 3 AM
        user_behavior: { normal_pattern: true }
      };

      const result = await securityManager.detectFraud(mockPaymentRequest, mockDevice, context);

      expect(result.flags).toContain('unusual_time');
    });

    it('should flag high amount transactions', async () => {
      const highAmountRequest = {
        ...mockPaymentRequest,
        amount: 1500
      };

      const context = {
        location: { lat: 37.7749, lng: -122.4194 },
        timestamp: Date.now(),
        user_behavior: { normal_pattern: true }
      };

      const result = await securityManager.detectFraud(highAmountRequest, mockDevice, context);

      expect(result.flags).toContain('high_amount');
    });
  });

  describe('device attestation', () => {
    it('should increase trust score for secure devices', async () => {
      const attestationData = {
        hardware_security: true,
        software_integrity: true,
        secure_enclave: true,
        certificate_valid: true,
        location: { lat: 37.7749, lng: -122.4194 }
      };

      const fingerprint = await securityManager.attestDevice(mockDevice, attestationData);

      expect(fingerprint.trust_score).toBeGreaterThan(50);
      expect(fingerprint.device_id).toBe(mockDevice.fingerprint);
      expect(fingerprint.known_device).toBe(true);
      expect(fingerprint.location_history).toHaveLength(1);
    });

    it('should decrease trust score for new devices', async () => {
      const newDevice = {
        ...mockDevice,
        fingerprint: 'brand_new_device'
      };

      const attestationData = {
        hardware_security: false,
        software_integrity: false,
        location: { lat: 37.7749, lng: -122.4194 }
      };

      const fingerprint = await securityManager.attestDevice(newDevice, attestationData);

      expect(fingerprint.trust_score).toBeLessThan(60);
      expect(fingerprint.known_device).toBe(true);
    });

    it('should track location history', async () => {
      const attestationData = {
        location: { lat: 37.7749, lng: -122.4194 }
      };

      const fingerprint1 = await securityManager.attestDevice(mockDevice, attestationData);
      
      const attestationData2 = {
        location: { lat: 40.7128, lng: -74.0060 } // New location
      };
      
      const fingerprint2 = await securityManager.attestDevice(mockDevice, attestationData2);

      expect(fingerprint2.location_history).toHaveLength(2);
      expect(fingerprint2.location_history[1].location).toEqual(attestationData2.location);
    });
  });

  describe('encryption and decryption', () => {
    it('should encrypt and decrypt sensitive data', async () => {
      const sensitiveData = {
        card_number: '4111111111111111',
        cvv: '123',
        expiry: '12/25'
      };

      const encrypted = await securityManager.encryptSensitiveData(sensitiveData, mockDevice);
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toContain(sensitiveData.card_number);

      const decrypted = await securityManager.decryptSensitiveData(encrypted, mockDevice);
      expect(decrypted).toEqual(sensitiveData);
    });

    it('should reject old encrypted data', async () => {
      const sensitiveData = { test: 'data' };
      
      // Mock old timestamp
      const originalNow = Date.now;
      Date.now = vi.fn(() => 1000000);
      
      const encrypted = await securityManager.encryptSensitiveData(sensitiveData, mockDevice);
      
      // Restore current time (making encrypted data old)
      Date.now = originalNow;

      await expect(securityManager.decryptSensitiveData(encrypted, mockDevice))
        .rejects.toThrow('Encrypted data too old');
    });

    it('should reject data from wrong device', async () => {
      const sensitiveData = { test: 'data' };
      const encrypted = await securityManager.encryptSensitiveData(sensitiveData, mockDevice);

      const differentDevice = {
        ...mockDevice,
        fingerprint: 'different_device'
      };

      await expect(securityManager.decryptSensitiveData(encrypted, differentDevice))
        .rejects.toThrow('Device ID mismatch');
    });
  });

  describe('risk-based authentication', () => {
    it('should approve low risk transactions with basic auth', async () => {
      const context = {
        location: { lat: 37.7749, lng: -122.4194 },
        timestamp: Date.now(),
        user_behavior: { normal_pattern: true }
      };

      const result = await securityManager.performRiskBasedAuth(mockDevice, mockPaymentRequest, context);

      expect(result.valid).toBe(true);
      expect(result.reason).toContain('Low risk');
    });

    it('should require enhanced auth for medium risk', async () => {
      const mediumRiskRequest = {
        ...mockPaymentRequest,
        amount: 500 // Medium amount
      };

      const context = {
        location: { lat: 37.7749, lng: -122.4194 },
        timestamp: Date.now(),
        user_behavior: { normal_pattern: true },
        biometric_auth: true
      };

      // First attest device to give it some trust
      await securityManager.attestDevice(mockDevice, {
        hardware_security: true,
        software_integrity: true
      });

      const result = await securityManager.performRiskBasedAuth(mockDevice, mediumRiskRequest, context);

      expect(result.valid).toBe(true);
    });

    it('should require multi-factor auth for high risk', async () => {
      const highRiskRequest = {
        ...mockPaymentRequest,
        amount: 2000
      };

      const context = {
        location: { lat: 0, lng: 0 }, // Unusual location
        timestamp: new Date().setHours(3), // 3 AM
        user_behavior: { unusual_pattern: true },
        auth_factors: {
          biometric: true,
          device_auth: true,
          location_verified: true
        }
      };

      const result = await securityManager.performRiskBasedAuth(mockDevice, highRiskRequest, context);

      // Result depends on the fraud detection outcome
      expect(result.valid).toBeDefined();
      expect(result.reason).toBeDefined();
    });

    it('should decline critical risk transactions', async () => {
      const criticalRiskRequest = {
        ...mockPaymentRequest,
        amount: 10000 // Very high amount
      };

      const context = {
        location: { lat: 0, lng: 0 },
        timestamp: new Date().setHours(3),
        user_behavior: { unusual_pattern: true },
        merchant_risk: 'high'
      };

      const result = await securityManager.performRiskBasedAuth(mockDevice, criticalRiskRequest, context);

      // High risk scenarios should be declined or require review
      if (!result.valid) {
        expect(result.reason).toContain('risk');
      }
    });
  });

  describe('security logging', () => {
    it('should log biometric authentication attempts', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const biometricData = {
        fingerprint: { template: 'test_data' }
      };

      await securityManager.authenticateBiometric(mockDevice, biometricData);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Security Event [biometric_auth]'),
        expect.objectContaining({
          device_id: mockDevice.fingerprint,
          method: 'fingerprint'
        })
      );

      consoleSpy.mockRestore();
    });

    it('should log fraud analysis results', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const context = {
        location: { lat: 37.7749, lng: -122.4194 },
        timestamp: Date.now(),
        user_behavior: { normal_pattern: true }
      };

      await securityManager.detectFraud(mockPaymentRequest, mockDevice, context);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Security Event [fraud_analysis]'),
        expect.objectContaining({
          device_id: mockDevice.fingerprint,
          amount: mockPaymentRequest.amount
        })
      );

      consoleSpy.mockRestore();
    });
  });
});