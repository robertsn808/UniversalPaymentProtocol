// Type for UPPTranslator output to fix type errors in tests
type UPPTranslatorOutput = {
  type: string;
  success: boolean;
  message?: string;
  vibration?: string;
  notification?: {
    title?: string;
    body?: string;
    icon?: string;
    [key: string]: any;
  };
  full_screen_message?: {
    title: string;
    background_color: string;
    [key: string]: any;
  };
  sound_effect?: string;
  speech?: string;
  should_speak?: boolean;
  [key: string]: any;
};
// UPP Translator tests
import { describe, it, expect, beforeEach } from 'vitest';
import { UPPTranslator } from '../modules/universal-payment-protocol/core/UPPTranslator';
import { DeviceCapabilities, UPPDevice, PaymentResult } from '../modules/universal-payment-protocol/core/types';

describe('UPPTranslator', () => {
  let translator: UPPTranslator;

  beforeEach(() => {
    translator = new UPPTranslator();
  });

  describe('translateInput', () => {
    it('should translate NFC input correctly', async () => {
      const nfcInput = {
        type: 'nfc_tap',
        amount: 25.99,
        merchant: 'Test Merchant',
        merchant_id: 'test_merchant'
      };

      const capabilities: DeviceCapabilities = {
        internet_connection: true,
        nfc: true
      };

      const result = await translator.translateInput(nfcInput, capabilities);

      expect(result.amount).toBe(25.99);
      expect(result.currency).toBe('USD');
      expect(result.description).toBe('NFC Payment');
      expect(result.merchant_id).toBe('test_merchant');
      expect(result.metadata?.input_type).toBe('nfc_tap');
    });

    it('should translate voice input correctly', async () => {
      const voiceInput = {
        type: 'voice_command',
        transcript: 'Pay fifteen dollars to Uber for my ride',
        confidence: 0.95
      };

      const capabilities: DeviceCapabilities = {
        internet_connection: true,
        microphone: true,
        voice_recognition: true
      };

      const result = await translator.translateInput(voiceInput, capabilities);

      expect(result.amount).toBe(15);
      expect(result.currency).toBe('USD');
      expect(result.merchant_id).toBe('uber');
      expect(result.metadata?.confidence).toBe(0.95);
    });

    it('should translate QR scan input correctly', async () => {
      const qrInput = {
        type: 'qr_scan',
        qr_data: {
          amount: 50.00,
          merchant: 'Coffee Shop',
          merchant_id: 'coffee_123'
        }
      };

      const capabilities: DeviceCapabilities = {
        internet_connection: true,
        camera: true
      };

      const result = await translator.translateInput(qrInput, capabilities);

      expect(result.amount).toBe(50.00);
      expect(result.merchant_id).toBe('coffee_123');
      expect(result.description).toContain('QR Payment');
    });
  });

  describe('translateOutput', () => {
    const mockDevice: UPPDevice = {
      deviceType: 'smartphone',
      fingerprint: 'test_device',
      capabilities: {
        internet_connection: true,
        display: 'touchscreen'
      },
      securityContext: {
        encryption_level: 'AES256'
      },
      handlePaymentResponse: async () => {},
      handleError: async () => {}
    };

    it('should translate successful payment for mobile device', async () => {
      const paymentResult: PaymentResult = {
        success: true,
        transaction_id: 'txn_123',
        amount: 25.99,
        currency: 'USD',
        status: 'completed'
      };

  const result = await translator.translateOutput(paymentResult, mockDevice) as UPPTranslatorOutput;

      expect(result.type).toBe('mobile_response');
      expect(result.success).toBe(true);
      expect(result.message).toBe('Payment successful!');
      expect(result.vibration).toBe('success_pattern');
      expect(result.notification?.title).toBe('Payment Successful');
    });

    it('should translate failed payment for mobile device', async () => {
      const paymentResult: PaymentResult = {
        success: false,
        status: 'failed',
        error_message: 'Payment declined'
      };

  const result = await translator.translateOutput(paymentResult, mockDevice) as UPPTranslatorOutput;

  expect(result.type).toBe('mobile_response');
  expect(result.success).toBe(false);
  expect(result.message).toBe('Payment failed');
  expect(result.vibration).toBe('error_pattern');
  expect(result.notification).toBeDefined();
  expect(result.notification!.title).toBe('Payment Failed');
    });

    it('should translate output for smart TV', async () => {
      const tvDevice: UPPDevice = {
        ...mockDevice,
        deviceType: 'smart_tv',
        capabilities: {
          internet_connection: true,
          display: 'large'
        }
      };

      const paymentResult: PaymentResult = {
        success: true,
        transaction_id: 'txn_tv_123',
        amount: 49.99,
        currency: 'USD',
        status: 'completed'
      };

  const result = await translator.translateOutput(paymentResult, tvDevice) as UPPTranslatorOutput;

      expect(result.type).toBe('tv_response');
      expect(result.full_screen_message).toBeDefined();
      expect(result.full_screen_message!.title).toBe('Payment Successful!');
      expect(result.full_screen_message!.background_color).toBe('#4CAF50');
      expect(result.sound_effect).toBe('success_chime');
    });
  });

  describe('translateError', () => {
    const mockDevice: UPPDevice = {
      deviceType: 'voice_assistant',
      fingerprint: 'test_voice_device',
      capabilities: {
        internet_connection: true,
        microphone: true,
        speaker: true
      },
      securityContext: {
        encryption_level: 'AES256'
      },
      handlePaymentResponse: async () => {},
      handleError: async () => {}
    };

    it('should translate error for voice assistant', async () => {
      const error = new Error('Payment processing failed');
      
      const result = await translator.translateError(error, mockDevice);

      expect(result.type).toBe('voice_response');
      expect(result.success).toBe(false);
      expect(result.speech).toContain('Sorry, your payment failed');
      expect(result.should_speak).toBe(true);
    });
  });
});