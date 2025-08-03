import { describe, it, expect, beforeEach } from 'vitest';
import { UniversalPaymentProtocol } from '../../../src/modules/universal-payment-protocol/core/UPPProtocol';
import { UPPConfig } from '../../../src/modules/universal-payment-protocol/core/types';

// Mock payment gateway for testing
class MockPaymentGateway {
  async processPayment(request: any) {
    return {
      success: true,
      transaction_id: 'test_txn_123',
      amount: request.amount,
      currency: request.currency,
      status: 'completed',
      receipt_data: {
        payment_intent_id: 'test_txn_123',
        amount: request.amount,
        currency: request.currency,
        description: request.description,
        merchant_id: request.merchant_id,
        timestamp: new Date().toISOString()
      }
    };
  }
}

describe('UniversalPaymentProtocol', () => {
  let upp: UniversalPaymentProtocol;
  let config: UPPConfig;

  beforeEach(() => {
    config = {
      paymentGateway: new MockPaymentGateway(),
      security: {
        encryption_key: 'test_key'
      },
      discovery: {
        enabled: true,
        scan_interval: 5000
      }
    };
    
    upp = new UniversalPaymentProtocol(config);
  });

  it('should initialize with correct configuration', () => {
    expect(upp).toBeDefined();
  });

  it('should register a device successfully', async () => {
    const mockDevice = {
      deviceType: 'smartphone',
      capabilities: {
        internet_connection: true,
        display: 'touchscreen' as const,
        input_methods: ['touch']
      },
      securityContext: {
        encryption_level: 'AES256'
      },
      fingerprint: 'test_fingerprint_123',
      handlePaymentResponse: async () => {},
      handleError: async () => {}
    };

    const deviceId = await upp.registerDevice(mockDevice);
    expect(deviceId).toContain('smartphone');
  });

  it('should reject device registration without internet connection', async () => {
    const mockDevice = {
      deviceType: 'smartphone',
      capabilities: {
        internet_connection: false
      },
      securityContext: {
        encryption_level: 'AES256'
      },
      fingerprint: 'test_fingerprint_456',
      handlePaymentResponse: async () => {},
      handleError: async () => {}
    };

    await expect(upp.registerDevice(mockDevice)).rejects.toThrow('Device registration failed');
  });
});
