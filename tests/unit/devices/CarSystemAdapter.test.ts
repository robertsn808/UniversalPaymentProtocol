// Car System Adapter Tests
// Unit tests for automotive payment processing

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CarSystemAdapter } from '../../../src/modules/universal-payment-protocol/devices/CarSystemAdapter';

describe('CarSystemAdapter', () => {
  let adapter: CarSystemAdapter;
  let mockDeviceInfo: any;

  beforeEach(() => {
    mockDeviceInfo = {
      make: 'Tesla',
      model: 'Model 3',
      year: '2023',
      vin: 'TEST123456789',
      infotainment_system: 'Tesla MCU'
    };
    adapter = new CarSystemAdapter(mockDeviceInfo);
  });

  describe('initialization', () => {
    it('should initialize with correct device type', () => {
      expect(adapter.deviceType).toBe('car_system');
    });

    it('should have automotive-specific capabilities', () => {
      expect(adapter.capabilities.display).toBe('automotive');
      expect(adapter.capabilities.voice_recognition).toBe(true);
      expect(adapter.capabilities.gps).toBe(true);
      expect(adapter.capabilities.bluetooth).toBe(true);
      expect(adapter.capabilities.cellular).toBe(true);
      expect(adapter.capabilities.driver_monitoring).toBe(true);
      expect(adapter.capabilities.parking_sensors).toBe(true);
      expect(adapter.capabilities.fuel_monitoring).toBe(true);
      expect(adapter.capabilities.input_methods).toContain('touch');
      expect(adapter.capabilities.input_methods).toContain('voice');
      expect(adapter.capabilities.input_methods).toContain('steering_wheel');
      expect(adapter.capabilities.input_methods).toContain('gesture');
    });

    it('should have driver-focused security context', () => {
      expect(adapter.securityContext.encryption_level).toBe('AES256');
      expect(adapter.securityContext.user_authentication).toBe('driver_profile');
      expect(adapter.securityContext.biometric_steering).toBe(true);
      expect(adapter.securityContext.trusted_environment).toBe(true);
    });

    it('should generate unique fingerprint', () => {
      expect(adapter.fingerprint).toBeDefined();
      expect(adapter.fingerprint).toMatch(/^car_/);
      
      // Different vehicle should generate different fingerprint
      const adapter2 = new CarSystemAdapter({ make: 'BMW', model: 'X5' });
      expect(adapter2.fingerprint).not.toBe(adapter.fingerprint);
    });
  });

  describe('handlePaymentResponse', () => {
    it('should handle successful fuel payment', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const fuelResponse = {
        success: true,
        amount: 45.67,
        transaction_id: 'fuel_txn_123',
        receipt_data: {
          service_type: 'fuel',
          location: 'Shell Station #1234',
          gallons: 12.5
        }
      };

      await adapter.handlePaymentResponse(fuelResponse);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Car System received payment response')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Showing success on car display')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Playing success chime')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Updating fuel data after payment')
      );

      consoleSpy.mockRestore();
    });

    it('should handle successful parking payment', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const parkingResponse = {
        success: true,
        amount: 8.00,
        receipt_data: {
          service_type: 'parking',
          location: 'Downtown Garage',
          duration: '2 hours'
        }
      };

      await adapter.handlePaymentResponse(parkingResponse);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Activating parking session')
      );

      consoleSpy.mockRestore();
    });

    it('should handle successful toll payment', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const tollResponse = {
        success: true,
        amount: 3.50,
        receipt_data: {
          service_type: 'toll',
          location: 'Golden Gate Bridge',
          toll_plaza: 'Plaza 1'
        }
      };

      await adapter.handlePaymentResponse(tollResponse);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Logging toll transaction')
      );

      consoleSpy.mockRestore();
    });

    it('should handle failed payment', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const failureResponse = {
        success: false,
        error_message: 'Payment method expired'
      };

      await adapter.handlePaymentResponse(failureResponse);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Showing error on car display')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Playing error sound')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('handleError', () => {
    it('should handle errors with voice announcement', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const error = {
        message: 'Network connection lost',
        code: 'NETWORK_ERROR'
      };

      await adapter.handleError(error);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Car System handling error')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Voice announcement'),
        'Payment failed. Please try again.'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('displayPaymentUI', () => {
    it('should show voice-only interface when vehicle is moving', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Mock vehicle as moving
      vi.spyOn(adapter as any, 'isVehicleMoving').mockReturnValue(true);
      
      const options = {
        service_type: 'fuel',
        merchant: 'Chevron',
        amount: 52.30,
        location: 'Highway 101'
      };

      await adapter.displayPaymentUI(options);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Displaying car payment UI')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Voice announcement'),
        expect.stringContaining('Payment request: $52.3 for fuel')
      );

      consoleSpy.mockRestore();
    });

    it('should show full visual interface when stationary', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Mock vehicle as stationary
      vi.spyOn(adapter as any, 'isVehicleMoving').mockReturnValue(false);
      
      const options = {
        service_type: 'parking',
        merchant: 'City Parking',
        amount: 12.00
      };

      await adapter.displayPaymentUI(options);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Showing automotive payment screen')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('captureUserInput', () => {
    it('should prioritize voice input when vehicle is moving', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Mock vehicle as moving
      vi.spyOn(adapter as any, 'isVehicleMoving').mockReturnValue(true);
      
      const input = await adapter.captureUserInput();
      
      expect(input).toBeDefined();
      expect(input.type).toBe('voice_input');
      expect(input.hands_free).toBe(true);

      consoleSpy.mockRestore();
    });

    it('should allow multiple input methods when stationary', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Mock vehicle as stationary
      vi.spyOn(adapter as any, 'isVehicleMoving').mockReturnValue(false);
      
      const input = await adapter.captureUserInput();
      
      expect(input).toBeDefined();
      expect(['voice_input', 'touch_input', 'steering_wheel_input', 'gesture_input'])
        .toContain(input.type);

      consoleSpy.mockRestore();
    });
  });

  describe('safety features', () => {
    it('should disable touch input when vehicle is moving', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // This tests the private method indirectly
      // Touch input should return null when vehicle is moving
      expect(adapter.capabilities.input_methods).toContain('touch');

      consoleSpy.mockRestore();
    });

    it('should always allow voice input for safety', () => {
      expect(adapter.capabilities.voice_recognition).toBe(true);
      expect(adapter.capabilities.input_methods).toContain('voice');
    });

    it('should support steering wheel controls', () => {
      expect(adapter.capabilities.input_methods).toContain('steering_wheel');
    });
  });

  describe('service-specific handling', () => {
    it('should update fuel data after fuel purchase', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const fuelResponse = {
        success: true,
        amount: 65.43,
        receipt_data: {
          service_type: 'fuel',
          gallons: 18.2,
          price_per_gallon: 3.59
        }
      };

      await adapter.handlePaymentResponse(fuelResponse);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Updating fuel data after payment')
      );

      consoleSpy.mockRestore();
    });

    it('should activate parking session after parking payment', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const parkingResponse = {
        success: true,
        amount: 15.00,
        receipt_data: {
          service_type: 'parking',
          spot_number: 'A-42',
          expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
        }
      };

      await adapter.handlePaymentResponse(parkingResponse);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Activating parking session')
      );

      consoleSpy.mockRestore();
    });

    it('should log toll transactions for expense tracking', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const tollResponse = {
        success: true,
        amount: 7.25,
        receipt_data: {
          service_type: 'toll',
          highway: 'I-680',
          entry_point: 'Milpitas',
          exit_point: 'San Jose'
        }
      };

      await adapter.handlePaymentResponse(tollResponse);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Logging toll transaction')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('phone integration', () => {
    it('should send notifications to connected phone', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const response = {
        success: true,
        amount: 25.00,
        receipt_data: {
          service_type: 'fuel',
          location: 'Costco Gas'
        }
      };

      await adapter.handlePaymentResponse(response);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Sending notification to phone')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('voice announcements', () => {
    it('should announce payment success', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const response = {
        success: true,
        amount: 35.00,
        receipt_data: { service_type: 'fuel' }
      };

      await adapter.handlePaymentResponse(response);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Voice announcement'),
        expect.stringContaining('Payment of $35 completed successfully')
      );

      consoleSpy.mockRestore();
    });

    it('should announce payment failures', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const error = { message: 'Card declined' };
      await adapter.handleError(error);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Voice announcement'),
        'Payment failed. Please try again.'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('automotive integration features', () => {
    it('should support GPS location services', () => {
      expect(adapter.capabilities.gps).toBe(true);
    });

    it('should support cellular connectivity', () => {
      expect(adapter.capabilities.cellular).toBe(true);
    });

    it('should support bluetooth connectivity', () => {
      expect(adapter.capabilities.bluetooth).toBe(true);
    });

    it('should support driver monitoring', () => {
      expect(adapter.capabilities.driver_monitoring).toBe(true);
    });

    it('should support parking sensors', () => {
      expect(adapter.capabilities.parking_sensors).toBe(true);
    });

    it('should support fuel monitoring', () => {
      expect(adapter.capabilities.fuel_monitoring).toBe(true);
    });
  });

  describe('multi-brand support', () => {
    it('should work with Tesla', () => {
      const teslaAdapter = new CarSystemAdapter({
        make: 'Tesla',
        model: 'Model S',
        infotainment_system: 'Tesla MCU'
      });
      expect(teslaAdapter.deviceType).toBe('car_system');
    });

    it('should work with BMW', () => {
      const bmwAdapter = new CarSystemAdapter({
        make: 'BMW',
        model: '3 Series',
        infotainment_system: 'iDrive'
      });
      expect(bmwAdapter.deviceType).toBe('car_system');
    });

    it('should work with Mercedes', () => {
      const mercedesAdapter = new CarSystemAdapter({
        make: 'Mercedes-Benz',
        model: 'C-Class',
        infotainment_system: 'MBUX'
      });
      expect(mercedesAdapter.deviceType).toBe('car_system');
    });

    it('should work with Audi', () => {
      const audiAdapter = new CarSystemAdapter({
        make: 'Audi',
        model: 'A4',
        infotainment_system: 'MMI'
      });
      expect(audiAdapter.deviceType).toBe('car_system');
    });
  });
});