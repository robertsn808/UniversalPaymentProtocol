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
      const fraudData = {
        amount: 50000, // $50,000
        deviceId: 'device-123',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      };

      const result = await securityManager.detectFraud(fraudData);

      expect(result.riskScore).toBeGreaterThan(50);
      expect(result.riskFactors).toContain('High transaction amount');
    });

    it('should detect suspicious device patterns', async () => {
      const fraudData = {
        amount: 100,
        deviceId: 'suspicious-device-999',
        ipAddress: '10.0.0.1',
        userAgent: 'SuspiciousBot/1.0'
      };

      const result = await securityManager.detectFraud(fraudData);

      expect(result.riskScore).toBeGreaterThan(0);
      expect(result.riskFactors).toBeDefined();
    });

    it('should handle missing user agent', async () => {
      const fraudData = {
        amount: 100,
        deviceId: 'device-123',
        ipAddress: '192.168.1.1'
      };

      const result = await securityManager.detectFraud(fraudData);

      expect(result.riskFactors).toContain('Missing user agent');
    });

    it('should detect multiple rapid transactions from same device', async () => {
      const deviceId = 'rapid-device-123';
      const fraudData = {
        amount: 100,
        deviceId,
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0'
      };

      // Simulate multiple rapid transactions
      for (let i = 0; i < 5; i++) {
        await securityManager.detectFraud(fraudData);
      }

      const result = await securityManager.detectFraud(fraudData);
      expect(result.riskScore).toBeGreaterThan(30);
    });

    it('should return appropriate recommendation based on risk level', async () => {
      const lowRiskData = {
        amount: 25,
        deviceId: 'trusted-device-123',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)'
      };

      const result = await securityManager.detectFraud(lowRiskData);
      expect(result.recommendation).toMatch(/allow|proceed/i);
    });
  });

  describe('Device Attestation', () => {
    it('should validate legitimate smartphone device', async () => {
      const deviceData = {
        deviceType: 'smartphone',
        fingerprint: 'legitimate-smartphone-fingerprint-12345',
        capabilities: ['touchscreen', 'camera', 'gps', 'nfc'],
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)'
      };

      const result = await securityManager.attestDevice(deviceData);

      expect(result).toMatchObject({
        isValid: true,
        trustScore: expect.any(Number),
        attestationFactors: expect.any(Array),
        warnings: expect.any(Array)
      });

      expect(result.trustScore).toBeGreaterThan(50);
    });

    it('should validate legitimate smart TV device', async () => {
      const deviceData = {
        deviceType: 'smart_tv',
        fingerprint: 'samsung-smart-tv-fingerprint-67890',
        capabilities: ['display', 'remote_control', 'wifi', 'streaming'],
        ipAddress: '192.168.1.10',
        userAgent: 'SmartTV/1.0 (Samsung; Tizen)'
      };

      const result = await securityManager.attestDevice(deviceData);

      expect(result.isValid).toBe(true);
      expect(result.trustScore).toBeGreaterThan(40);
    });

    it('should detect suspicious device fingerprints', async () => {
      const deviceData = {
        deviceType: 'smartphone',
        fingerprint: 'fake-device-123',
        capabilities: ['touchscreen'],
        ipAddress: '192.168.1.1'
      };

      const result = await securityManager.attestDevice(deviceData);

      expect(result.trustScore).toBeLessThan(80);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should validate device capabilities match device type', async () => {
      const smartphoneData = {
        deviceType: 'smartphone',
        fingerprint: 'smartphone-fingerprint-12345',
        capabilities: ['display', 'remote_control'], // TV capabilities on smartphone
        ipAddress: '192.168.1.1'
      };

      const result = await securityManager.attestDevice(smartphoneData);

      expect(result.warnings).toContain('Unusual capabilities for device type');
    });

    it('should handle missing capabilities', async () => {
      const deviceData = {
        deviceType: 'smartphone',
        fingerprint: 'smartphone-fingerprint-12345',
        capabilities: [],
        ipAddress: '192.168.1.1'
      };

      const result = await securityManager.attestDevice(deviceData);

      expect(result.warnings).toContain('No capabilities reported');
      expect(result.trustScore).toBeLessThan(60);
    });

    it('should validate IoT device with sensor capabilities', async () => {
      const iotData = {
        deviceType: 'iot_device',
        fingerprint: 'iot-sensor-device-98765',
        capabilities: ['temperature_sensor', 'humidity_sensor', 'wifi', 'low_power'],
        ipAddress: '192.168.1.50'
      };

      const result = await securityManager.attestDevice(iotData);

      expect(result.isValid).toBe(true);
      expect(result.attestationFactors).toContain('Valid IoT capabilities');
    });

    it('should validate gaming console with appropriate capabilities', async () => {
      const consoleData = {
        deviceType: 'gaming_console',
        fingerprint: 'ps5-console-fingerprint-11111',
        capabilities: ['controller', 'display', 'audio', 'network', 'storage'],
        ipAddress: '192.168.1.20',
        userAgent: 'PlayStation/5.0'
      };

      const result = await securityManager.attestDevice(consoleData);

      expect(result.isValid).toBe(true);
      expect(result.trustScore).toBeGreaterThan(60);
      expect(result.attestationFactors).toContain('Gaming console user agent detected');
    });

    it('should validate car system with safety-appropriate capabilities', async () => {
      const carData = {
        deviceType: 'car_system',
        fingerprint: 'tesla-infotainment-fingerprint-22222',
        capabilities: ['voice_control', 'display', 'gps', 'bluetooth', 'safety_systems'],
        ipAddress: '10.0.0.100',
        userAgent: 'CarOS/2.0 (Tesla Model S)'
      };

      const result = await securityManager.attestDevice(carData);

      expect(result.isValid).toBe(true);
      expect(result.trustScore).toBeGreaterThan(70);
      expect(result.attestationFactors).toContain('Automotive user agent detected');
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
      const result = await securityManager.detectFraud(null as any);
      
      expect(result.isHighRisk).toBe(true);
      expect(result.riskScore).toBe(100);
      expect(result.riskFactors).toContain('Invalid fraud detection data');
    });

    it('should handle empty device attestation data', async () => {
      const result = await securityManager.attestDevice({} as any);
      
      expect(result.isValid).toBe(false);
      expect(result.trustScore).toBe(0);
      expect(result.warnings).toContain('Missing required device data');
    });

    it('should handle empty biometric data', async () => {
      const result = await securityManager.authenticateBiometric({} as any);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid biometric data');
    });

    it('should rate limit fraud detection calls', async () => {
      const fraudData = {
        amount: 100,
        deviceId: 'rate-limit-test-device',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0'
      };

      // Make many rapid calls
      const promises = Array(20).fill(null).map(() => 
        securityManager.detectFraud(fraudData)
      );

      const results = await Promise.all(promises);
      
      // Some calls should have higher risk scores due to rate limiting
      const highRiskResults = results.filter(r => r.riskScore > 50);
      expect(highRiskResults.length).toBeGreaterThan(0);
    });

    it('should maintain device attestation cache', async () => {
      const deviceData = {
        deviceType: 'smartphone',
        fingerprint: 'cache-test-fingerprint-12345',
        capabilities: ['touchscreen', 'camera'],
        ipAddress: '192.168.1.1'
      };

      // First call
      const result1 = await securityManager.attestDevice(deviceData);
      
      // Second call should use cache (same fingerprint)
      const result2 = await securityManager.attestDevice(deviceData);

      expect(result1.trustScore).toBe(result2.trustScore);
      expect(result1.isValid).toBe(result2.isValid);
    });
  });
});