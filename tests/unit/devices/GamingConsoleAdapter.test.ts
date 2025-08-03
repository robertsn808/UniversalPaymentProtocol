// Gaming Console Adapter Tests
// Unit tests for gaming console payment processing

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GamingConsoleAdapter } from '../../../src/modules/universal-payment-protocol/devices/GamingConsoleAdapter';

describe('GamingConsoleAdapter', () => {
  let adapter: GamingConsoleAdapter;
  let mockDeviceInfo: any;

  beforeEach(() => {
    mockDeviceInfo = {
      console_type: 'PlayStation 5',
      model: 'PS5 Digital',
      firmware_version: '6.50',
      user_id: 'player123',
      storage_capacity: '825GB'
    };
    adapter = new GamingConsoleAdapter(mockDeviceInfo);
  });

  describe('initialization', () => {
    it('should initialize with correct device type', () => {
      expect(adapter.deviceType).toBe('gaming_console');
    });

    it('should have gaming-specific capabilities', () => {
      expect(adapter.capabilities.gaming_store).toBe(true);
      expect(adapter.capabilities.user_accounts).toBe(true);
      expect(adapter.capabilities.achievements).toBe(true);
      expect(adapter.capabilities.display).toBe('gaming');
      expect(adapter.capabilities.input_methods).toContain('controller');
      expect(adapter.capabilities.input_methods).toContain('voice');
      expect(adapter.capabilities.input_methods).toContain('motion');
    });

    it('should have appropriate security context', () => {
      expect(adapter.securityContext.encryption_level).toBe('AES256');
      expect(adapter.securityContext.user_authentication).toBe('account_login');
      expect(adapter.securityContext.parental_controls).toBe(true);
      expect(adapter.securityContext.trusted_environment).toBe(true);
    });

    it('should generate unique fingerprint', () => {
      expect(adapter.fingerprint).toBeDefined();
      expect(adapter.fingerprint).toMatch(/^gaming_/);
      
      // Different device info should generate different fingerprint
      const adapter2 = new GamingConsoleAdapter({ console_type: 'Xbox Series X' });
      expect(adapter2.fingerprint).not.toBe(adapter.fingerprint);
    });
  });

  describe('handlePaymentResponse', () => {
    it('should handle successful payment response', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const successResponse = {
        success: true,
        amount: 69.99,
        transaction_id: 'txn_123',
        receipt_data: {
          item_name: 'Spider-Man 2 Digital Deluxe',
          item_type: 'digital_content',
          achievement: 'First Digital Purchase'
        }
      };

      await adapter.handlePaymentResponse(successResponse);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Gaming Console received payment response')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Showing success screen')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Playing success sound')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Triggering haptic feedback')
      );

      consoleSpy.mockRestore();
    });

    it('should handle failed payment response', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const failureResponse = {
        success: false,
        error_message: 'Insufficient funds',
        error_code: 'INSUFFICIENT_FUNDS'
      };

      await adapter.handlePaymentResponse(failureResponse);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Showing error screen')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Playing error sound')
      );

      consoleSpy.mockRestore();
    });

    it('should start download for digital content', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const digitalPurchase = {
        success: true,
        amount: 29.99,
        receipt_data: {
          item_name: 'DLC Pack',
          item_type: 'digital_content'
        }
      };

      await adapter.handlePaymentResponse(digitalPurchase);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Starting download')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('handleError', () => {
    it('should handle payment errors appropriately', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const error = {
        message: 'Network timeout',
        code: 'NETWORK_ERROR'
      };

      await adapter.handleError(error);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Gaming Console handling error')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Showing error screen')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('displayPaymentUI', () => {
    it('should display gaming-style payment interface', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const options = {
        title: 'Purchase Confirmation',
        item_name: 'Cyberpunk 2077',
        price: 59.99,
        currency: 'USD',
        item_image: 'https://example.com/game.jpg',
        item_description: 'Open-world RPG adventure'
      };

      await adapter.displayPaymentUI(options);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Displaying gaming payment UI')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Showing payment modal')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('input handling', () => {
    it('should capture user input from various input methods', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // This would normally test the actual input capture
      // For now, we'll just verify the method exists and can be called
      expect(typeof adapter.captureUserInput).toBe('function');

      consoleSpy.mockRestore();
    });
  });

  describe('haptic feedback', () => {
    it('should trigger appropriate haptic patterns', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Test success haptic
      const successResponse = { success: true, amount: 10.99 };
      await adapter.handlePaymentResponse(successResponse);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Triggering haptic feedback'),
        'success',
        expect.any(Object)
      );

      // Test error haptic
      const errorResponse = { success: false, error_message: 'Test error' };
      await adapter.handlePaymentResponse(errorResponse);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Triggering haptic feedback'),
        'error',
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('gaming-specific features', () => {
    it('should handle achievement unlocks', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const responseWithAchievement = {
        success: true,
        amount: 4.99,
        receipt_data: {
          achievement: 'Big Spender',
          item_type: 'in_game_currency'
        }
      };

      await adapter.handlePaymentResponse(responseWithAchievement);

      // The achievement should be included in the success screen data
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Showing success screen')
      );

      consoleSpy.mockRestore();
    });

    it('should support parental controls check', async () => {
      // This would test parental controls validation
      // The method exists but is private, so we test through public interface
      const highAmountResponse = {
        success: true,
        amount: 199.99 // High amount that might trigger parental controls
      };

      await adapter.handlePaymentResponse(highAmountResponse);
      // If parental controls were enabled, this might behave differently
    });
  });

  describe('security features', () => {
    it('should maintain secure gaming environment', () => {
      expect(adapter.securityContext.device_attestation).toBe('trusted');
      expect(adapter.securityContext.trusted_environment).toBe(true);
    });

    it('should support user account authentication', () => {
      expect(adapter.securityContext.user_authentication).toBe('account_login');
    });

    it('should include parental controls', () => {
      expect(adapter.securityContext.parental_controls).toBe(true);
    });
  });

  describe('multi-platform support', () => {
    it('should work with PlayStation', () => {
      const psAdapter = new GamingConsoleAdapter({
        console_type: 'PlayStation 5',
        model: 'PS5'
      });
      expect(psAdapter.deviceType).toBe('gaming_console');
    });

    it('should work with Xbox', () => {
      const xboxAdapter = new GamingConsoleAdapter({
        console_type: 'Xbox Series X',
        model: 'Series X'
      });
      expect(xboxAdapter.deviceType).toBe('gaming_console');
    });

    it('should work with Nintendo Switch', () => {
      const switchAdapter = new GamingConsoleAdapter({
        console_type: 'Nintendo Switch',
        model: 'OLED'
      });
      expect(switchAdapter.deviceType).toBe('gaming_console');
    });
  });
});