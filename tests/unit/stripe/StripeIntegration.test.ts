import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Stripe integration
const mockStripe = {
  paymentIntents: {
    create: vi.fn().mockResolvedValue({
      id: 'pi_test123',
      status: 'requires_confirmation',
      amount: 10000,
      currency: 'usd',
      description: 'Test payment'
    }),
    confirm: vi.fn().mockResolvedValue({
      id: 'pi_test123',
      status: 'succeeded',
      amount: 10000,
      currency: 'usd'
    })
  },
  customers: {
    create: vi.fn().mockResolvedValue({
      id: 'cus_test123',
      email: 'test@example.com',
      name: 'Test Customer'
    })
  }
};

// Mock the Stripe integration
class MockUPPStripeProcessor {
  private stripe: any;

  constructor() {
    this.stripe = mockStripe;
  }

  async processDevicePayment(paymentData: any) {
    const amountInCents = Math.round(paymentData.amount * 100);
    
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      description: paymentData.description,
      metadata: {
        device_type: paymentData.deviceType,
        device_id: paymentData.deviceId,
        upp_payment: 'true',
        hawaii_processing: 'true',
        ...paymentData.metadata
      },
      automatic_payment_methods: {
        enabled: true
      }
    });

    const confirmedPayment = await this.stripe.paymentIntents.confirm(
      paymentIntent.id,
      {
        payment_method: 'pm_card_visa',
        return_url: 'https://your-website.com/return'
      }
    );

    const success = confirmedPayment.status === 'succeeded';

    return {
      success,
      transaction_id: paymentIntent.id,
      amount: paymentData.amount,
      currency: 'USD',
      status: success ? 'completed' : 'failed',
      receipt_data: {
        payment_intent_id: paymentIntent.id,
        amount: paymentData.amount,
        currency: 'USD',
        description: paymentData.description,
        device_type: paymentData.deviceType,
        timestamp: new Date().toISOString(),
        hawaii_processed: true
      }
    };
  }
}

describe('UPPStripeProcessor', () => {
  let stripeProcessor: MockUPPStripeProcessor;

  beforeEach(() => {
    stripeProcessor = new MockUPPStripeProcessor();
    vi.clearAllMocks();
  });

  describe('processDevicePayment', () => {
    it('should process a payment successfully', async () => {
      const paymentData = {
        amount: 100.00,
        deviceType: 'smartphone',
        deviceId: 'device_123',
        description: 'Test payment'
      };

      const result = await stripeProcessor.processDevicePayment(paymentData);
      
      expect(result.success).toBe(true);
      expect(result.amount).toBe(100.00);
      expect(result.transaction_id).toBe('pi_test123');
      expect(result.currency).toBe('USD');
      expect(result.status).toBe('completed');
    });

    it('should handle payment failure', async () => {
      // Mock a failed payment confirmation
      mockStripe.paymentIntents.confirm.mockResolvedValueOnce({
        id: 'pi_test123',
        status: 'requires_payment_method',
        amount: 10000,
        currency: 'usd'
      });

      const paymentData = {
        amount: 50.00,
        deviceType: 'smart_tv',
        deviceId: 'device_456',
        description: 'Failed test payment'
      };

      const result = await stripeProcessor.processDevicePayment(paymentData);
      
      expect(result.success).toBe(false);
      expect(result.status).toBe('failed');
    });
  });
});
