// Smartwatch Adapter Tests
// Unit tests for smartwatch payment processing

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SmartwatchAdapter } from '../../../src/modules/universal-payment-protocol/devices/SmartwatchAdapter';

describe('SmartwatchAdapter', () => {
  let adapter: SmartwatchAdapter;
  let mockDeviceInfo: any;

  beforeEach(() => {
    mockDeviceInfo = {
      model: 'Apple Watch Series 8',
      brand: 'Apple',
      os_version: 'watchOS 9.0',
      case_size: '45mm',
      paired_phone: 'iPhone 14 Pro'
    };
    adapter = new SmartwatchAdapter(mockDeviceInfo);
  });

  describe('initialization', () => {
    it('should initialize with correct device type', () => {
      expect(adapter.deviceType).toBe('smartwatch');
    });

    it('should have smartwatch-specific capabilities', () => {
      expect(adapter.capabilities.display).toBe('small');
      expect(adapter.capabilities.haptic).toBe(true);
      expect(adapter.capabilities.heart_rate).toBe(true);
      expect(adapter.capabilities.nfc).toBe(true);
      expect(adapter.capabilities.biometric).toBe(true);
      expect(adapter.capabilities.gps).toBe(true);
      expect(adapter.capabilities.accelerometer).toBe(true);
      expect(adapter.capabilities.gyroscope).toBe(true);
      expect(adapter.capabilities.always_on_display).toBe(true);
      expect(adapter.capabilities.input_methods).toContain('touch');
      expect(adapter.capabilities.input_methods).toContain('voice');
      expect(adapter.capabilities.input_methods).toContain('crown');
      expect(adapter.capabilities.input_methods).toContain('button');
      expect(adapter.capabilities.input_methods).toContain('gesture');
    });

    it('should have biometric security context', () => {
      expect(adapter.securityContext.encryption_level).toBe('AES256');
      expect(adapter.securityContext.user_authentication).toBe('biometric_wrist_detection');
      expect(adapter.securityContext.biometric_lock).toBe(true);
      expect(adapter.securityContext.trusted_environment).toBe(true);
    });

    it('should generate unique fingerprint', () => {
      expect(adapter.fingerprint).toBeDefined();
      expect(adapter.fingerprint).toMatch(/^smartwatch_/);
      
      // Different device info should generate different fingerprint
      const adapter2 = new SmartwatchAdapter({ model: 'Galaxy Watch 5' });
      expect(adapter2.fingerprint).not.toBe(adapter.fingerprint);
    });
  });

  describe('handlePaymentResponse', () => {
    it('should handle successful payment with haptic feedback', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const successResponse = {
        success: true,
        amount: 4.75,
        transaction_id: 'txn_456',
        receipt_data: {
          merchant: 'Coffee Shop',
          timestamp: new Date().toISOString()
        }
      };

      await adapter.handlePaymentResponse(successResponse);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Smartwatch received payment response')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Showing success animation')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Triggering success haptic')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Displaying success message')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Sending notification to phone')
      );

      consoleSpy.mockRestore();
    });

    it('should handle failed payment with error haptic', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const failureResponse = {
        success: false,
        error_message: 'Card declined'
      };

      await adapter.handlePaymentResponse(failureResponse);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Showing error animation')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Triggering error haptic')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Displaying error message')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('handleError', () => {
    it('should handle errors with appropriate feedback', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const error = {
        message: 'Connection timeout',
        code: 'TIMEOUT'
      };

      await adapter.handleError(error);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Smartwatch handling error')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Showing error animation')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Triggering error haptic')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('displayPaymentUI', () => {
    it('should display compact payment interface', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const options = {
        merchant: 'Starbucks',
        amount: 5.25,
        currency: 'USD',
        payment_method: 'Apple Pay'
      };

      await adapter.displayPaymentUI(options);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Displaying smartwatch payment UI')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Showing payment card')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('captureUserInput', () => {
    it('should capture input from multiple methods', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Test that the method exists and can be called
      const inputPromise = adapter.captureUserInput();
      expect(inputPromise).toBeInstanceOf(Promise);
      
      // Wait for one of the input methods to resolve
      const input = await inputPromise;
      expect(input).toBeDefined();
      expect(input.type).toBeDefined();
      expect(input.timestamp).toBeDefined();

      consoleSpy.mockRestore();
    });
  });

  describe('haptic feedback patterns', () => {
    it('should execute success haptic pattern', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const successResponse = { success: true, amount: 10.00 };
      await adapter.handlePaymentResponse(successResponse);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Triggering success haptic')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Executing haptic pattern'),
        expect.arrayContaining([
          expect.objectContaining({ duration: 100, intensity: 0.8 }),
          expect.objectContaining({ pause: 50 }),
          expect.objectContaining({ duration: 100, intensity: 0.8 })
        ])
      );

      consoleSpy.mockRestore();
    });

    it('should execute error haptic pattern', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const errorResponse = { success: false, error_message: 'Test error' };
      await adapter.handlePaymentResponse(errorResponse);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Triggering error haptic')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Executing haptic pattern'),
        expect.arrayContaining([
          expect.objectContaining({ duration: 300, intensity: 1.0 })
        ])
      );

      consoleSpy.mockRestore();
    });
  });

  describe('biometric features', () => {
    it('should support biometric authentication', () => {
      expect(adapter.capabilities.biometric).toBe(true);
      expect(adapter.securityContext.biometric_lock).toBe(true);
      expect(adapter.securityContext.user_authentication).toBe('biometric_wrist_detection');
    });

    it('should support heart rate monitoring', () => {
      expect(adapter.capabilities.heart_rate).toBe(true);
    });
  });

  describe('input methods', () => {
    it('should support touch input', async () => {
      // This tests the private method indirectly through captureUserInput
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const input = await adapter.captureUserInput();
      
      // One of the input methods should resolve
      expect(['touch_input', 'voice_input', 'crown_input', 'button_input', 'gesture_input', 'nfc_tap'])
        .toContain(input.type);

      consoleSpy.mockRestore();
    });

    it('should support voice input', () => {
      expect(adapter.capabilities.input_methods).toContain('voice');
    });

    it('should support crown input (for Apple Watch-like devices)', () => {
      expect(adapter.capabilities.input_methods).toContain('crown');
    });

    it('should support button input', () => {
      expect(adapter.capabilities.input_methods).toContain('button');
    });

    it('should support gesture input', () => {
      expect(adapter.capabilities.input_methods).toContain('gesture');
    });
  });

  describe('NFC payments', () => {
    it('should support NFC tap payments', () => {
      expect(adapter.capabilities.nfc).toBe(true);
    });

    it('should handle NFC payment methods', async () => {
      const input = await adapter.captureUserInput();
      
      // NFC tap might be one of the resolved input methods
      if (input.type === 'nfc_tap') {
        expect(input.payment_method).toBeDefined();
        expect(input.card_last_four).toBeDefined();
      }
    });
  });

  describe('phone integration', () => {
    it('should send notifications to paired phone', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const successResponse = {
        success: true,
        amount: 15.50,
        transaction_id: 'txn_789',
        receipt_data: { merchant: 'Gas Station' }
      };

      await adapter.handlePaymentResponse(successResponse);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Sending notification to phone')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('health monitoring integration', () => {
    it('should support health metrics monitoring', () => {
      expect(adapter.capabilities.heart_rate).toBe(true);
      expect(adapter.capabilities.accelerometer).toBe(true);
      expect(adapter.capabilities.gyroscope).toBe(true);
    });
  });

  describe('display features', () => {
    it('should support always-on display', () => {
      expect(adapter.capabilities.always_on_display).toBe(true);
    });

    it('should have small display optimized for watch', () => {
      expect(adapter.capabilities.display).toBe('small');
    });
  });

  describe('multi-brand support', () => {
    it('should work with Apple Watch', () => {
      const appleWatch = new SmartwatchAdapter({
        model: 'Apple Watch Ultra',
        brand: 'Apple'
      });
      expect(appleWatch.deviceType).toBe('smartwatch');
    });

    it('should work with Samsung Galaxy Watch', () => {
      const galaxyWatch = new SmartwatchAdapter({
        model: 'Galaxy Watch 5 Pro',
        brand: 'Samsung'
      });
      expect(galaxyWatch.deviceType).toBe('smartwatch');
    });

    it('should work with Garmin watches', () => {
      const garminWatch = new SmartwatchAdapter({
        model: 'Fenix 7',
        brand: 'Garmin'
      });
      expect(garminWatch.deviceType).toBe('smartwatch');
    });
  });
});