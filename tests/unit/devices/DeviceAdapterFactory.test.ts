// Device Adapter Factory Tests
// Comprehensive unit tests for device adapter factory and management

import { describe, it, expect, beforeEach } from 'vitest';
import { DeviceAdapterFactory } from '../../../src/modules/universal-payment-protocol/devices/DeviceAdapterFactory';
import { SmartTVAdapter } from '../../../src/modules/universal-payment-protocol/devices/SmartTVAdapter';
import { IoTDeviceAdapter } from '../../../src/modules/universal-payment-protocol/devices/IoTDeviceAdapter';
import { VoiceAssistantAdapter } from '../../../src/modules/universal-payment-protocol/devices/VoiceAssistantAdapter';
import { GamingConsoleAdapter } from '../../../src/modules/universal-payment-protocol/devices/GamingConsoleAdapter';
import { SmartwatchAdapter } from '../../../src/modules/universal-payment-protocol/devices/SmartwatchAdapter';
import { CarSystemAdapter } from '../../../src/modules/universal-payment-protocol/devices/CarSystemAdapter';

describe('DeviceAdapterFactory', () => {
  beforeEach(() => {
    // Reset factory state if needed
  });

  describe('createAdapter', () => {
    it('should create SmartTV adapter', () => {
      const deviceInfo = { model: 'Samsung QLED', brand: 'Samsung' };
      const adapter = DeviceAdapterFactory.createAdapter('smart_tv', deviceInfo);
      
      expect(adapter).toBeInstanceOf(SmartTVAdapter);
      expect(adapter.deviceType).toBe('smart_tv');
      expect(adapter.capabilities.display).toBe('large');
      expect(adapter.capabilities.qr_generator).toBe(true);
    });

    it('should create IoT device adapter', () => {
      const deviceInfo = { type: 'smart_fridge', brand: 'LG' };
      const adapter = DeviceAdapterFactory.createAdapter('iot_device', deviceInfo);
      
      expect(adapter).toBeInstanceOf(IoTDeviceAdapter);
      expect(adapter.deviceType).toBe('iot_device');
      expect(adapter.capabilities.sensors).toBe(true);
      expect(adapter.capabilities.automated_purchasing).toBe(true);
    });

    it('should create Voice Assistant adapter', () => {
      const deviceInfo = { model: 'Echo Dot', brand: 'Amazon' };
      const adapter = DeviceAdapterFactory.createAdapter('voice_assistant', deviceInfo);
      
      expect(adapter).toBeInstanceOf(VoiceAssistantAdapter);
      expect(adapter.deviceType).toBe('voice_assistant');
      expect(adapter.capabilities.voice_recognition).toBe(true);
      expect(adapter.capabilities.natural_language).toBe(true);
    });

    it('should create Gaming Console adapter', () => {
      const deviceInfo = { console_type: 'PlayStation 5', model: 'PS5' };
      const adapter = DeviceAdapterFactory.createAdapter('gaming_console', deviceInfo);
      
      expect(adapter).toBeInstanceOf(GamingConsoleAdapter);
      expect(adapter.deviceType).toBe('gaming_console');
      expect(adapter.capabilities.gaming_store).toBe(true);
      expect(adapter.capabilities.user_accounts).toBe(true);
    });

    it('should create Smartwatch adapter', () => {
      const deviceInfo = { model: 'Apple Watch Series 8', brand: 'Apple' };
      const adapter = DeviceAdapterFactory.createAdapter('smartwatch', deviceInfo);
      
      expect(adapter).toBeInstanceOf(SmartwatchAdapter);
      expect(adapter.deviceType).toBe('smartwatch');
      expect(adapter.capabilities.haptic).toBe(true);
      expect(adapter.capabilities.heart_rate).toBe(true);
    });

    it('should create Car System adapter', () => {
      const deviceInfo = { make: 'Tesla', model: 'Model 3', year: '2023' };
      const adapter = DeviceAdapterFactory.createAdapter('car_system', deviceInfo);
      
      expect(adapter).toBeInstanceOf(CarSystemAdapter);
      expect(adapter.deviceType).toBe('car_system');
      expect(adapter.capabilities.gps).toBe(true);
      expect(adapter.capabilities.driver_monitoring).toBe(true);
    });

    it('should throw error for unsupported device type', () => {
      expect(() => {
        DeviceAdapterFactory.createAdapter('unsupported_device', {});
      }).toThrow('No adapter available for device type: unsupported_device');
    });
  });

  describe('getSupportedDeviceTypes', () => {
    it('should return all supported device types', () => {
      const supportedTypes = DeviceAdapterFactory.getSupportedDeviceTypes();
      
      expect(supportedTypes).toContain('smart_tv');
      expect(supportedTypes).toContain('iot_device');
      expect(supportedTypes).toContain('voice_assistant');
      expect(supportedTypes).toContain('gaming_console');
      expect(supportedTypes).toContain('smartwatch');
      expect(supportedTypes).toContain('car_system');
      expect(supportedTypes.length).toBe(7); // 6 built-in + 1 custom device registered automatically
    });
  });

  describe('isDeviceTypeSupported', () => {
    it('should return true for supported device types', () => {
      expect(DeviceAdapterFactory.isDeviceTypeSupported('smart_tv')).toBe(true);
      expect(DeviceAdapterFactory.isDeviceTypeSupported('gaming_console')).toBe(true);
      expect(DeviceAdapterFactory.isDeviceTypeSupported('smartwatch')).toBe(true);
    });

    it('should return false for unsupported device types', () => {
      expect(DeviceAdapterFactory.isDeviceTypeSupported('hologram')).toBe(false);
      expect(DeviceAdapterFactory.isDeviceTypeSupported('quantum_computer')).toBe(false);
    });
  });

  describe('detectDeviceType', () => {
    it('should detect Smart TV from capabilities', () => {
      const capabilities = {
        internet_connection: true,
        display: 'large' as const,
        qr_generator: true,
        input_methods: ['remote', 'voice']
      };
      
      const detectedType = DeviceAdapterFactory.detectDeviceType(capabilities);
      expect(detectedType).toBe('smart_tv');
    });

    it('should detect IoT device from capabilities', () => {
      const capabilities = {
        internet_connection: true,
        sensors: true,
        automated_purchasing: true,
        display: 'minimal' as const
      };
      
      const detectedType = DeviceAdapterFactory.detectDeviceType(capabilities);
      expect(detectedType).toBe('iot_device');
    });

    it('should detect Voice Assistant from capabilities', () => {
      const capabilities = {
        internet_connection: true,
        voice_recognition: true,
        natural_language: true,
        speaker: true,
        microphone: true
      };
      
      const detectedType = DeviceAdapterFactory.detectDeviceType(capabilities);
      expect(detectedType).toBe('voice_assistant');
    });

    it('should detect Gaming Console from capabilities', () => {
      const capabilities = {
        internet_connection: true,
        display: 'gaming' as const,
        gaming_store: true,
        user_accounts: true,
        input_methods: ['controller']
      };
      
      const detectedType = DeviceAdapterFactory.detectDeviceType(capabilities);
      expect(detectedType).toBe('gaming_console');
    });

    it('should detect Smartwatch from capabilities', () => {
      const capabilities = {
        internet_connection: true,
        display: 'small' as const,
        haptic: true,
        heart_rate: true,
        nfc: true,
        biometric: true
      };
      
      const detectedType = DeviceAdapterFactory.detectDeviceType(capabilities);
      expect(detectedType).toBe('smartwatch');
    });

    it('should detect Car System from capabilities', () => {
      const capabilities = {
        internet_connection: true,
        display: 'automotive' as const,
        gps: true,
        driver_monitoring: true,
        voice_recognition: true
      };
      
      const detectedType = DeviceAdapterFactory.detectDeviceType(capabilities);
      expect(detectedType).toBe('car_system');
    });

    it('should detect Smartphone from capabilities', () => {
      const capabilities = {
        internet_connection: true,
        display: 'touchscreen' as const,
        nfc: true,
        biometric: true,
        camera: true,
        gps: true
      };
      
      const detectedType = DeviceAdapterFactory.detectDeviceType(capabilities);
      expect(detectedType).toBe('smartphone');
    });

    it('should return null for unknown device capabilities', () => {
      const capabilities = {
        internet_connection: true,
        display: 'holographic' as any,
        quantum_processor: true
      };
      
      const detectedType = DeviceAdapterFactory.detectDeviceType(capabilities);
      expect(detectedType).toBe(null);
    });
  });

  describe('getDeviceCapabilities', () => {
    it('should return capabilities for supported device type', () => {
      const capabilities = DeviceAdapterFactory.getDeviceCapabilities('smart_tv');
      
      expect(capabilities).toBeDefined();
      expect(capabilities?.display).toBe('large');
      expect(capabilities?.qr_generator).toBe(true);
      expect(capabilities?.internet_connection).toBe(true);
    });

    it('should return null for unsupported device type', () => {
      const capabilities = DeviceAdapterFactory.getDeviceCapabilities('quantum_computer');
      expect(capabilities).toBe(null);
    });
  });

  describe('registerAdapter', () => {
    it('should register custom device adapter', () => {
      class TestAdapter {
        deviceType = 'test_device';
        capabilities = { internet_connection: true };
        securityContext = { encryption_level: 'AES256' };
        fingerprint = 'test_fingerprint';
        
        constructor(deviceInfo: any) {}
        
        async handlePaymentResponse(response: any): Promise<void> {}
        async handleError(error: any): Promise<void> {}
      }

      DeviceAdapterFactory.registerAdapter('test_device', TestAdapter as any);
      
      expect(DeviceAdapterFactory.isDeviceTypeSupported('test_device')).toBe(true);
      
      const adapter = DeviceAdapterFactory.createAdapter('test_device', {});
      expect(adapter.deviceType).toBe('test_device');
    });
  });
});