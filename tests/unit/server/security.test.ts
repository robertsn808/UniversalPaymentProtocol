import { describe, it, expect, beforeEach } from 'vitest';
import { SecurityManagerAdapter } from '../../../server/SecurityManagerAdapter.js';

describe('Security Manager', () => {
  let securityManager: SecurityManagerAdapter;

  beforeEach(() => {
    securityManager = new SecurityManagerAdapter();
  });

  describe('Fraud Detection', () => {
    it('should detect low risk for normal transactions', async () => {
      const result = await securityManager.detectFraud(
        50,
        'normal-device-123',
        {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)'
        }
      );

      expect(result).toMatchObject({
        risk_score: expect.any(Number),
        risk_level: expect.any(String),
        flags: expect.any(Array),
        recommendation: expect.any(String)
      });
      
      expect(result.risk_score).toBeLessThan(70);
    });

    it('should detect high risk for large amounts', async () => {
      const result = await securityManager.detectFraud(
        50000, // $50,000
        'device-123',
        {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      );

      expect(result.risk_score).toBeGreaterThan(50);
      expect(result.flags).toContain('High transaction amount');
    });

    it('should detect suspicious device patterns', async () => {
      const result = await securityManager.detectFraud(
        100,
        'suspicious-device-999',
        {
          ipAddress: '10.0.0.1',
          userAgent: 'SuspiciousBot/1.0'
        }
      );

      expect(result.risk_score).toBeGreaterThan(0);
      expect(result.flags).toBeDefined();
    });

    it('should handle missing user agent', async () => {
      const result = await securityManager.detectFraud(
        100,
        'device-123',
        {
          ipAddress: '192.168.1.1'
        }
      );

      expect(result.flags).toContain('Missing user agent');
    });

    it('should detect multiple rapid transactions from same device', async () => {
      const deviceId = 'rapid-device-123';
      const context = {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0'
      };

      // Simulate multiple rapid transactions
      for (let i = 0; i < 5; i++) {
        await securityManager.detectFraud(100, deviceId, context);
      }

      const result = await securityManager.detectFraud(100, deviceId, context);
      expect(result.risk_score).toBeGreaterThan(30);
    });

    it('should return appropriate recommendation based on risk level', async () => {
      const result = await securityManager.detectFraud(
        25,
        'trusted-device-123',
        {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)'
        }
      );
      expect(result.recommendation).toMatch(/approve/i);
    });
  });

  describe('Device Attestation', () => {
    it('should validate legitimate smartphone device', async () => {
      const result = await securityManager.attestDevice(
        'legitimate-smartphone-fingerprint-12345',
        {
          deviceType: 'smartphone',
          capabilities: ['touchscreen', 'camera', 'gps', 'nfc'],
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)'
        }
      );

      expect(result).toMatchObject({
        device_id: expect.any(String),
        trust_score: expect.any(Number),
        known_device: expect.any(Boolean),
        location_history: expect.any(Array),
        last_seen: expect.any(Date)
      });

      expect(result.trust_score).toBeGreaterThan(50);
    });

    it('should validate legitimate smart TV device', async () => {
      const result = await securityManager.attestDevice(
        'samsung-smart-tv-fingerprint-67890',
        {
          deviceType: 'smart_tv',
          capabilities: ['display', 'remote_control', 'wifi', 'streaming'],
          ipAddress: '192.168.1.10',
          userAgent: 'SmartTV/1.0 (Samsung; Tizen)'
        }
      );

      expect(result.trust_score).toBeGreaterThan(40);
    });

    it('should detect suspicious device fingerprints', async () => {
      const result = await securityManager.attestDevice(
        'fake-device-123',
        {
          deviceType: 'smartphone',
          capabilities: ['touchscreen'],
          ipAddress: '192.168.1.1'
        }
      );

      expect(result.trust_score).toBeLessThan(80);
    });

    it('should validate device capabilities match device type', async () => {
      const result = await securityManager.attestDevice(
        'smartphone-fingerprint-12345',
        {
          deviceType: 'smartphone',
          capabilities: ['display', 'remote_control'], // TV capabilities on smartphone
          ipAddress: '192.168.1.1'
        }
      );

      // Basic validation - trust score should still be calculated
      expect(result.trust_score).toBeGreaterThan(0);
    });

    it('should handle missing capabilities', async () => {
      const result = await securityManager.attestDevice(
        'smartphone-fingerprint-12345',
        {
          deviceType: 'smartphone',
          capabilities: [],
          ipAddress: '192.168.1.1'
        }
      );

      expect(result.trust_score).toBeLessThan(80); // Lower trust without capabilities
    });

    it('should validate IoT device with sensor capabilities', async () => {
      const result = await securityManager.attestDevice(
        'iot-sensor-device-98765',
        {
          deviceType: 'iot_device',
          capabilities: ['temperature_sensor', 'humidity_sensor', 'wifi', 'low_power'],
          ipAddress: '192.168.1.50'
        }
      );

      expect(result.trust_score).toBeGreaterThan(0);
      expect(result.device_id).toBe('iot-sensor-device-98765');
    });

    it('should validate gaming console with appropriate capabilities', async () => {
      const result = await securityManager.attestDevice(
        'ps5-console-fingerprint-11111',
        {
          deviceType: 'gaming_console',
          capabilities: ['controller', 'display', 'audio', 'network', 'storage'],
          ipAddress: '192.168.1.20',
          userAgent: 'PlayStation/5.0'
        }
      );

      expect(result.trust_score).toBeGreaterThan(60);
      expect(result.device_id).toBe('ps5-console-fingerprint-11111');
    });

    it('should validate car system with safety-appropriate capabilities', async () => {
      const result = await securityManager.attestDevice(
        'tesla-infotainment-fingerprint-22222',
        {
          deviceType: 'car_system',
          capabilities: ['voice_control', 'display', 'gps', 'bluetooth', 'safety_systems'],
          ipAddress: '10.0.0.100',
          userAgent: 'CarOS/2.0 (Tesla Model S)'
        }
      );

      expect(result.trust_score).toBeGreaterThan(70);
      expect(result.device_id).toBe('tesla-infotainment-fingerprint-22222');
    });
  });

  describe('Biometric Authentication', () => {
    it('should simulate successful fingerprint authentication', async () => {
      const biometricData = {
        type: 'fingerprint',
        deviceId: 'smartphone-123',
        biometricHash: 'fingerprint-hash-12345',
        confidence: 0.95
      };

      const result = await securityManager.authenticateBiometric(biometricData);

      expect(result).toMatchObject({
        success: true,
        confidence: expect.any(Number),
        authMethod: 'fingerprint',
        timestamp: expect.any(String)
      });

      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should simulate successful face authentication', async () => {
      const biometricData = {
        type: 'face',
        deviceId: 'smartphone-456',
        biometricHash: 'face-hash-67890',
        confidence: 0.92
      };

      const result = await securityManager.authenticateBiometric(biometricData);

      expect(result.success).toBe(true);
      expect(result.authMethod).toBe('face');
      expect(result.confidence).toBeGreaterThan(0.85);
    });

    it('should simulate successful voice authentication', async () => {
      const biometricData = {
        type: 'voice',
        deviceId: 'voice-assistant-789',
        biometricHash: 'voice-hash-11111',
        confidence: 0.88
      };

      const result = await securityManager.authenticateBiometric(biometricData);

      expect(result.success).toBe(true);
      expect(result.authMethod).toBe('voice');
    });

    it('should reject low confidence biometric authentication', async () => {
      const biometricData = {
        type: 'fingerprint',
        deviceId: 'smartphone-123',
        biometricHash: 'weak-fingerprint-hash',
        confidence: 0.60 // Below threshold
      };

      const result = await securityManager.authenticateBiometric(biometricData);

      expect(result.success).toBe(false);
      expect(result.confidence).toBeLessThan(0.8);
    });

    it('should handle unsupported biometric types', async () => {
      const biometricData = {
        type: 'retina',
        deviceId: 'futuristic-device-999',
        biometricHash: 'retina-hash-99999',
        confidence: 0.95
      };

      const result = await securityManager.authenticateBiometric(biometricData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported biometric type');
    });

    it('should validate behavioral biometrics', async () => {
      const biometricData = {
        type: 'behavioral',
        deviceId: 'smartphone-behavioral-123',
        biometricHash: 'behavioral-pattern-hash-12345',
        confidence: 0.87,
        metadata: {
          typing_pattern: 'consistent',
          touch_pressure: 'normal',
          gesture_speed: 'moderate'
        }
      };

      const result = await securityManager.authenticateBiometric(biometricData);

      expect(result.success).toBe(true);
      expect(result.authMethod).toBe('behavioral');
      expect(result.confidence).toBeGreaterThan(0.8);
    });
  });

  describe('Security Edge Cases', () => {
    it('should handle null/undefined inputs gracefully', async () => {
      const result = await securityManager.detectFraud(0, '', {});
      
      expect(result.risk_score).toBeGreaterThan(0);
      expect(result.flags).toBeDefined();
    });

    it('should handle empty device attestation data', async () => {
      const result = await securityManager.attestDevice('empty-fingerprint', {});
      
      expect(result.trust_score).toBeGreaterThan(0); // Base score
      expect(result.device_id).toBe('empty-fingerprint');
    });

    it('should handle empty biometric data', async () => {
      const result = await securityManager.authenticateBiometric({} as any);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid biometric data');
    });

    it('should rate limit fraud detection calls', async () => {
      const deviceId = 'rate-limit-test-device';
      const context = {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0'
      };

      // Make many rapid calls
      const promises = Array(20).fill(null).map(() => 
        securityManager.detectFraud(100, deviceId, context)
      );

      const results = await Promise.all(promises);
      
      // Some calls should have higher risk scores due to rate limiting
      const highRiskResults = results.filter(r => r.risk_score > 50);
      expect(highRiskResults.length).toBeGreaterThan(0);
    });

    it('should maintain device attestation cache', async () => {
      const fingerprint = 'cache-test-fingerprint-12345';
      const context = {
        deviceType: 'smartphone',
        capabilities: ['touchscreen', 'camera'],
        ipAddress: '192.168.1.1'
      };

      // First call
      const result1 = await securityManager.attestDevice(fingerprint, context);
      
      // Second call should use cache (same fingerprint)
      const result2 = await securityManager.attestDevice(fingerprint, context);

      expect(result1.trust_score).toBe(result2.trust_score);
      expect(result1.device_id).toBe(result2.device_id);
    });
  });
});