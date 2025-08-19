
import { universalPaymentGateway, PaymentRequest, DevicePaymentRequest, PaymentResult } from './universal-payment-gateway.js';
import { visaDirectProcessor } from './visa-direct-processor.js';
import secureLogger from '../shared/logger.js';

/**
 * Payment Processor Factory
 * Creates appropriate payment processors based on configuration
 * Replaces Stripe functionality with Visa Direct integration
 */
export interface PaymentProcessor {
  processPayment(request: PaymentRequest): Promise<PaymentResult>;
  processDevicePayment(request: DevicePaymentRequest): Promise<PaymentResult>;
  createCustomer(data: { email: string; name?: string; metadata?: any }): Promise<any>;
  createPaymentMethod(data: any): Promise<any>;
  getPaymentStatus(transactionId: string): Promise<any>;
  refundPayment(data: any): Promise<any>;
}

export class UPPPaymentProcessor implements PaymentProcessor {
  constructor() {
    secureLogger.info('UPP Payment Processor initialized with Visa Direct');
  }

  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    console.log(`💳 Processing UPP payment: $${request.amount} ${request.currency}`);
    return await universalPaymentGateway.processPayment(request);
  }

  async processDevicePayment(request: DevicePaymentRequest): Promise<PaymentResult> {
    console.log(`📱 Processing UPP device payment: $${request.amount} on ${request.device_type}`);
    return await universalPaymentGateway.processDevicePayment(request);
  }

  async createCustomer(data: { email: string; name?: string; metadata?: any }): Promise<any> {
    console.log(`👤 Creating UPP customer: ${data.email}`);
    return await universalPaymentGateway.createCustomer(data);
  }

  async createPaymentMethod(data: any): Promise<any> {
    console.log(`💳 Creating UPP payment method`);
    return await universalPaymentGateway.createPaymentMethod(data);
  }

  async getPaymentStatus(transactionId: string): Promise<any> {
    return await visaDirectProcessor.getTransactionStatus(transactionId);
  }

  async refundPayment(data: any): Promise<any> {
    console.log(`💰 Processing UPP refund: ${data.transaction_id}`);
    return await universalPaymentGateway.processRefund(data);
  }
}

// Mock payment processor for testing when Visa is not configured
export class MockPaymentProcessor implements PaymentProcessor {
  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    console.log('🎭 Mock payment processing (Visa not configured)');
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simulate 90% success rate
    const success = Math.random() > 0.1;
    
    return {
      success,
      transaction_id: `mock_txn_${Date.now()}`,
      amount: request.amount,
      currency: request.currency,
      status: success ? 'completed' : 'failed',
      payment_method: request.payment_method,
      error_message: success ? undefined : 'Mock payment failed',
      receipt_data: {
        transaction_id: `mock_txn_${Date.now()}`,
        amount: request.amount,
        currency: request.currency,
        description: request.description,
        timestamp: new Date().toISOString(),
        merchant_id: request.merchant_id,
        payment_method: request.payment_method,
        mock_payment: true
      }
    };
  }

  async processDevicePayment(request: DevicePaymentRequest): Promise<PaymentResult> {
    console.log(`🎭 Mock ${request.device_type} payment processing: $${request.amount}`);
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Simulate 95% success rate for device payments
    const success = Math.random() > 0.05;
    
    return {
      success,
      transaction_id: `mock_device_${Date.now()}`,
      amount: request.amount,
      currency: 'USD',
      status: success ? 'completed' : 'failed',
      payment_method: 'card',
      error_message: success ? undefined : 'Mock device payment failed',
      receipt_data: {
        transaction_id: `mock_device_${Date.now()}`,
        amount: request.amount,
        currency: 'USD',
        description: request.description,
        timestamp: new Date().toISOString(),
        merchant_id: 'MOCK_MERCHANT',
        payment_method: 'card',
        device_type: request.device_type,
        device_id: request.device_id,
        mock_payment: true
      }
    };
  }

  async createCustomer(data: { email: string; name?: string; metadata?: any }): Promise<any> {
    return {
      id: `mock_cus_${Date.now()}`,
      email: data.email,
      name: data.name,
      created_at: new Date(),
      mock_customer: true
    };
  }

  async createPaymentMethod(data: any): Promise<any> {
    return {
      id: `mock_pm_${Date.now()}`,
      type: 'card',
      card: {
        last_four: '4242',
        brand: 'visa',
        exp_month: '12',
        exp_year: '2025'
      },
      created_at: new Date(),
      mock_payment_method: true
    };
  }

  async getPaymentStatus(transactionId: string): Promise<any> {
    return {
      id: transactionId,
      status: 'succeeded',
      amount: 100,
      currency: 'USD',
      mock_status: true
    };
  }

  async refundPayment(data: any): Promise<any> {
    return {
      id: `mock_refund_${Date.now()}`,
      amount: data.amount || 100,
      currency: 'USD',
      status: 'succeeded',
      mock_refund: true
    };
  }
}

// Factory function to create appropriate payment processor
export function createPaymentProcessor(): PaymentProcessor {
  const visaUserId = process.env.VISA_USER_ID;
  const visaPassword = process.env.VISA_PASSWORD;
  
  if (!visaUserId || !visaPassword || visaUserId === 'demo_mode') {
    console.log('🔄 Creating mock payment processor for demo mode');
    return new MockPaymentProcessor();
  }
  
  console.log('💳 Creating UPP payment processor with Visa Direct');
  return new UPPPaymentProcessor();
}
