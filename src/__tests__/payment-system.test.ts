
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { universalPaymentGateway } from '../payments/universal-payment-gateway';
import { visaDirectProcessor } from '../payments/visa-direct-processor';
import { createPaymentProcessor } from '../payments/payment-processor-factory';

// Mock Visa Direct API responses
vi.mock('../payments/visa-direct-processor', () => ({
  visaDirectProcessor: {
    processTokenPayment: vi.fn(),
    tokenizeCard: vi.fn(),
    getTransactionStatus: vi.fn(),
    processRefund: vi.fn()
  }
}));

describe('Universal Payment Gateway', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Payment Processing', () => {
    it('should process a successful card payment', async () => {
      // Mock successful Visa response
      vi.mocked(visaDirectProcessor.tokenizeCard).mockResolvedValue({
        token: 'visa_token_123',
        last_four: '4242',
        brand: 'VISA',
        exp_month: '12',
        exp_year: '2025',
        created_at: new Date(),
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      });

      vi.mocked(visaDirectProcessor.processTokenPayment).mockResolvedValue({
        success: true,
        transaction_id: 'txn_123',
        visa_transaction_id: 'visa_txn_123',
        amount: 100,
        currency: 'USD',
        status: 'approved',
        approval_code: '123456',
        response_code: '00',
        response_message: 'Approved',
        processing_fee: 0.25,
        interchange_fee: 1.45
      });

      const paymentRequest = {
        amount: 100,
        currency: 'USD',
        description: 'Test payment',
        merchant_id: 'test_merchant',
        customer_email: 'test@example.com',
        payment_method: 'card' as const,
        card_data: {
          number: '4242424242424242',
          exp_month: '12',
          exp_year: '2025',
          cvv: '123'
        }
      };

      const result = await universalPaymentGateway.processPayment(paymentRequest);

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.amount).toBe(100);
      expect(result.currency).toBe('USD');
      expect(result.payment_method).toBe('card');
      expect(result.processing_fee).toBeDefined();
      expect(result.receipt_data).toBeDefined();
    });

    it('should handle payment failure gracefully', async () => {
      vi.mocked(visaDirectProcessor.tokenizeCard).mockResolvedValue({
        token: 'visa_token_123',
        last_four: '4242',
        brand: 'VISA',
        exp_month: '12',
        exp_year: '2025',
        created_at: new Date(),
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      });

      vi.mocked(visaDirectProcessor.processTokenPayment).mockResolvedValue({
        success: false,
        transaction_id: 'txn_124',
        amount: 100,
        currency: 'USD',
        status: 'declined',
        response_code: '05',
        response_message: 'Do not honor',
        error_message: 'Card declined'
      });

      const paymentRequest = {
        amount: 100,
        currency: 'USD',
        description: 'Test payment',
        merchant_id: 'test_merchant',
        payment_method: 'card' as const,
        card_data: {
          number: '4000000000000002',
          exp_month: '12',
          exp_year: '2025',
          cvv: '123'
        }
      };

      const result = await universalPaymentGateway.processPayment(paymentRequest);

      expect(result.success).toBe(false);
      expect(result.status).toBe('declined');
      expect(result.error_message).toBe('Card declined');
    });

    it('should validate payment request data', async () => {
      const invalidPaymentRequest = {
        amount: -100, // Invalid negative amount
        currency: 'USD',
        description: 'Test payment',
        merchant_id: 'test_merchant',
        payment_method: 'card' as const
      };

      await expect(
        universalPaymentGateway.processPayment(invalidPaymentRequest)
      ).rejects.toThrow();
    });
  });

  describe('Device Payments', () => {
    it('should process device payments successfully', async () => {
      vi.mocked(visaDirectProcessor.tokenizeCard).mockResolvedValue({
        token: 'visa_token_device',
        last_four: '4242',
        brand: 'VISA',
        exp_month: '12',
        exp_year: '2025',
        created_at: new Date(),
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      });

      vi.mocked(visaDirectProcessor.processTokenPayment).mockResolvedValue({
        success: true,
        transaction_id: 'device_txn_123',
        amount: 50,
        currency: 'USD',
        status: 'approved',
        approval_code: '789012',
        response_code: '00',
        response_message: 'Approved',
        processing_fee: 0.25,
        interchange_fee: 0.75
      });

      const devicePaymentRequest = {
        amount: 50,
        device_type: 'smartphone',
        device_id: 'device_123',
        description: 'Device payment test',
        customer_email: 'device@example.com',
        card_data: {
          number: '4242424242424242',
          exp_month: '12',
          exp_year: '2025',
          cvv: '123'
        }
      };

      const result = await universalPaymentGateway.processDevicePayment(devicePaymentRequest);

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(result.amount).toBe(50);
      expect(result.receipt_data?.device_type).toBe('smartphone');
    });
  });

  describe('Payment Intents', () => {
    it('should create payment intent successfully', async () => {
      const intentData = {
        amount: 200,
        currency: 'USD',
        customer_email: 'intent@example.com',
        description: 'Test payment intent'
      };

      const intent = await universalPaymentGateway.createPaymentIntent(intentData);

      expect(intent.id).toMatch(/^pi_/);
      expect(intent.amount).toBe(200);
      expect(intent.currency).toBe('USD');
      expect(intent.status).toBe('requires_payment_method');
      expect(intent.client_secret).toContain('secret');
    });

    it('should confirm payment intent successfully', async () => {
      // First create an intent
      const intent = await universalPaymentGateway.createPaymentIntent({
        amount: 150,
        currency: 'USD',
        description: 'Confirmation test'
      });

      // Mock successful confirmation
      vi.mocked(visaDirectProcessor.tokenizeCard).mockResolvedValue({
        token: 'visa_token_intent',
        last_four: '4242',
        brand: 'VISA',
        exp_month: '12',
        exp_year: '2025',
        created_at: new Date(),
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      });

      vi.mocked(visaDirectProcessor.processTokenPayment).mockResolvedValue({
        success: true,
        transaction_id: intent.id,
        amount: 150,
        currency: 'USD',
        status: 'approved',
        approval_code: '654321',
        response_code: '00',
        response_message: 'Approved'
      });

      const confirmedIntent = await universalPaymentGateway.confirmPaymentIntent(intent.id, {
        card: {
          number: '4242424242424242',
          exp_month: '12',
          exp_year: '2025',
          cvv: '123'
        }
      });

      expect(confirmedIntent.status).toBe('succeeded');
    });
  });

  describe('Customer Management', () => {
    it('should create customer successfully', async () => {
      const customerData = {
        email: 'customer@example.com',
        name: 'Test Customer',
        metadata: { source: 'test' }
      };

      const customer = await universalPaymentGateway.createCustomer(customerData);

      expect(customer.id).toMatch(/^cus_/);
      expect(customer.email).toBe('customer@example.com');
      expect(customer.name).toBe('Test Customer');
      expect(customer.payment_methods).toEqual([]);
    });
  });

  describe('Payment Methods', () => {
    it('should create payment method with card tokenization', async () => {
      vi.mocked(visaDirectProcessor.tokenizeCard).mockResolvedValue({
        token: 'visa_token_pm',
        last_four: '4242',
        brand: 'VISA',
        exp_month: '12',
        exp_year: '2025',
        created_at: new Date(),
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      });

      const paymentMethodData = {
        type: 'card' as const,
        card: {
          number: '4242424242424242',
          exp_month: '12',
          exp_year: '2025',
          cvv: '123',
          holder_name: 'Test Cardholder'
        }
      };

      const paymentMethod = await universalPaymentGateway.createPaymentMethod(paymentMethodData);

      expect(paymentMethod.id).toMatch(/^pm_/);
      expect(paymentMethod.type).toBe('card');
      expect(paymentMethod.card?.last_four).toBe('4242');
      expect(paymentMethod.card?.brand).toBe('VISA');
      expect(paymentMethod.card?.token).toBe('visa_token_pm');
    });
  });

  describe('Refunds', () => {
    it('should process refund successfully', async () => {
      vi.mocked(visaDirectProcessor.processRefund).mockResolvedValue({
        success: true,
        transaction_id: 'refund_123',
        amount: 75,
        currency: 'USD',
        status: 'approved',
        response_code: '00',
        response_message: 'Refund approved'
      });

      const refundData = {
        transaction_id: 'original_txn_123',
        amount: 75,
        reason: 'Customer requested refund'
      };

      const refund = await universalPaymentGateway.processRefund(refundData);

      expect(refund.status).toBe('succeeded');
      expect(refund.amount).toBe(75);
      expect(refund.currency).toBe('USD');
    });
  });
});

describe('Payment Processor Factory', () => {
  it('should create UPP processor when Visa credentials are provided', () => {
    // Mock environment variables
    process.env.VISA_USER_ID = 'test_user';
    process.env.VISA_PASSWORD = 'test_password';

    const processor = createPaymentProcessor();
    expect(processor).toBeDefined();
  });

  it('should create mock processor when no credentials provided', () => {
    // Clear environment variables
    delete process.env.VISA_USER_ID;
    delete process.env.VISA_PASSWORD;

    const processor = createPaymentProcessor();
    expect(processor).toBeDefined();
  });
});

describe('Error Handling', () => {
  it('should handle network errors gracefully', async () => {
    vi.mocked(visaDirectProcessor.tokenizeCard).mockRejectedValue(
      new Error('Network connection failed')
    );

    const paymentRequest = {
      amount: 100,
      currency: 'USD',
      description: 'Test payment',
      merchant_id: 'test_merchant',
      payment_method: 'card' as const,
      card_data: {
        number: '4242424242424242',
        exp_month: '12',
        exp_year: '2025',
        cvv: '123'
      }
    };

    const result = await universalPaymentGateway.processPayment(paymentRequest);

    expect(result.success).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.error_message).toContain('Network connection failed');
  });

  it('should handle invalid card data', async () => {
    const paymentRequest = {
      amount: 100,
      currency: 'USD',
      description: 'Test payment',
      merchant_id: 'test_merchant',
      payment_method: 'card' as const,
      card_data: {
        number: 'invalid_card_number',
        exp_month: '12',
        exp_year: '2025',
        cvv: '123'
      }
    };

    const result = await universalPaymentGateway.processPayment(paymentRequest);
    expect(result.success).toBe(false);
    expect(result.error_message).toContain('Invalid card');
  });

  it('should reject invalid payment requests', async () => {
    const paymentRequest = {
      amount: -50, // Invalid amount
      currency: 'USD',
      description: 'Test payment',
      it('should handle payment processor failures', async () => {
        vi.mocked(visaDirectProcessor.tokenizeCard).mockRejectedValue(
          new Error('Payment processor unavailable')
        exp_month: '12',
        exp_year: '2025',
        cvv: '123'
      }
    };
  
    await expect(
      universalPaymentGateway.processPayment(paymentRequest)
    ).rejects.toThrow('Invalid payment request');
  });
  });

  it('should handle payment processor failures', async () => {
    vi.mocked(visaDirectProcessor.processPayment).mockRejectedValue(
      new Error('Payment processor unavailable')
    );

    const paymentRequest = {
      amount: 100,
      currency: 'USD',
      description: 'Test payment',
      merchant_id: 'test_merchant',
      payment_method: 'card' as const,
      card_data: {
        number: '4242424242424242',
        exp_month: '12',
        exp_year: '2025',
        cvv: '123'
      }
    };

    const result = await universalPaymentGateway.processPayment(paymentRequest);
    expect(result.success).toBe(false);
    expect(result.error_message).toContain('Payment processor unavailable');
  });
});
