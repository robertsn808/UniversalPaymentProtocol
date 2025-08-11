// Stripe Integration for Universal Payment Protocol
// Hawaii-based payment processing! 🌊💳

import Stripe from 'stripe';

import { PaymentRequest, PaymentResult } from '../src/modules/universal-payment-protocol/core/types.js';

export class UPPStripeProcessor {
  private stripe: Stripe;

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    
    if (!secretKey || secretKey === 'sk_test_demo_mode') {
      throw new Error('Use createPaymentProcessor() factory function instead of direct constructor');
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-07-30.basil'
    });

    console.log('💳 Stripe processor initialized for UPP');
  }

  async processDevicePayment(paymentData: {
    amount: number;
    deviceType: string;
    deviceId: string;
    description: string;
    customerEmail?: string;
    metadata?: any;
  }): Promise<PaymentResult> {
    try {
      console.log(`💳 Processing ${paymentData.deviceType} payment: $${paymentData.amount}`);

      // Convert amount to cents (Stripe requirement)
      const amountInCents = Math.round(paymentData.amount * 100);

      // Create payment intent
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

      // For demo purposes, we'll auto-confirm the payment
      // In production, this would be handled by the client
      const confirmedPayment = await this.stripe.paymentIntents.confirm(
        paymentIntent.id,
        {
          payment_method: 'pm_card_visa', // Test payment method
          return_url: 'https://your-website.com/return'
        }
      );

      const success = confirmedPayment.status === 'succeeded';

      const result: PaymentResult = {
        success,
        transactionId: paymentIntent.id,
        amount: paymentData.amount,
        currency: 'USD',
        metadata: {
          payment_intent_id: paymentIntent.id,
          amount: paymentData.amount,
          currency: 'USD',
          description: paymentData.description,
          device_type: paymentData.deviceType,
          timestamp: new Date().toISOString(),
          hawaii_processed: true
        }
      };

      if (!success) {
        result.error = 'Payment confirmation failed';
      }

      // Note: Actual logging is handled in server/index.ts with secure logger
      // Only log payment intent ID prefix for security
      console.log(`${success ? '✅' : '❌'} Stripe payment ${success ? 'completed' : 'failed'}: ${paymentIntent.id?.substring(0, 10)}...`);
      
      return result;

    } catch (error: any) {
      // Secure error logging - don't expose sensitive Stripe details
      console.error('💥 Stripe payment error: [Error details logged separately]');
      
      return {
        success: false,
        error: 'failed',
        error: error.message || 'Payment processing failed'
      };
    }
  }

  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    try {
      console.log(`💳 Processing UPP payment: $${request.amount} ${request.currency}`);

      // Convert amount to cents
      const amountInCents = Math.round(request.amount * 100);

      // Create payment intent
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: amountInCents,
        currency: request.currency.toLowerCase(),
        description: request.description,
        metadata: {
          merchantId: request.merchantId,
          upp_protocol: 'true',
          hawaii_processing: 'true',
          location: request.location ? JSON.stringify(request.location) : '',
          ...request.metadata
        },
        automatic_payment_methods: {
          enabled: true
        }
      });

      // Auto-confirm for demo (in production, client would confirm)
      const confirmedPayment = await this.stripe.paymentIntents.confirm(
        paymentIntent.id,
        {
          payment_method: 'pm_card_visa'
        }
      );

      const success = confirmedPayment.status === 'succeeded';

      const result: PaymentResult = {
        success,
        transactionId: paymentIntent.id,
        amount: request.amount,
        currency: request.currency,
        metadata: {
          payment_intent_id: paymentIntent.id,
          amount: request.amount,
          currency: request.currency,
          description: request.description,
          merchantId: request.merchantId,
          timestamp: new Date().toISOString(),
          hawaii_processed: true,
          location: request.location
        }
      };

      if (!success) {
        result.error = 'Payment confirmation failed';
      }

      console.log(`${success ? '✅' : '❌'} UPP payment ${success ? 'completed' : 'failed'}: ${paymentIntent.id}`);
      
      return result;

    } catch (error: any) {
      console.error('💥 UPP payment error:', error.message);
      
      return {
        success: false,
        error: 'failed',
        error: error.message || 'Payment processing failed'
      };
    }
  }

  async createCustomer(email: string, name?: string, metadata?: any): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.create({
        email,
        name,
        metadata: {
          upp_customer: 'true',
          created_by: 'kai_upp_system',
          hawaii_based: 'true',
          ...metadata
        }
      });

      console.log(`👤 Customer created: ${customer.id} (${email})`);
      return customer;
    } catch (error: any) {
      console.error('Customer creation failed:', error);
      throw error;
    }
  }

  async getPaymentStatus(paymentIntentId: string): Promise<any> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      
      return {
        id: paymentIntent.id,
        error: paymentIntent.status,
        amount: paymentIntent.amount / 100, // Convert back from cents
        currency: paymentIntent.currency.toUpperCase(),
        description: paymentIntent.description,
        metadata: paymentIntent.metadata
      };
    } catch (error: any) {
      console.error('Failed to retrieve payment error:', error);
      throw error;
    }
  }

  async refundPayment(paymentIntentId: string, amount?: number): Promise<any> {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount ? Math.round(amount * 100) : undefined // Convert to cents if specified
      });

      console.log(`💰 Refund processed: ${refund.id}`);
      return refund;
    } catch (error: any) {
      console.error('Refund failed:', error);
      throw error;
    }
  }
}

// Mock payment gateway for demo/testing when Stripe is not configured
export class MockPaymentGateway {
  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    console.log('🎭 Mock payment processing (Stripe not configured)');
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simulate 90% success rate
    const success = Math.random() > 0.1;
    
    return {
      success,
      transactionId: `mock_txn_${Date.now()}`,
      amount: request.amount,
      currency: request.currency,
      error: success ? undefined : 'Mock payment failed',
      metadata: {
        mock_payment: true,
        amount: request.amount,
        currency: request.currency,
        description: request.description,
        merchantId: request.merchantId,
        timestamp: new Date().toISOString()
      }
    };
  }

  async processDevicePayment(paymentData: {
    amount: number;
    deviceType: string;
    deviceId: string;
    description: string;
    customerEmail?: string;
    metadata?: any;
  }): Promise<PaymentResult> {
    console.log(`🎭 Mock ${paymentData.deviceType} payment processing: $${paymentData.amount}`);
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Simulate 95% success rate for device payments
    const success = Math.random() > 0.05;
    
    return {
      success,
      transactionId: `mock_device_${Date.now()}`,
      amount: paymentData.amount,
      currency: 'USD',
      error: success ? undefined : 'Mock device payment failed',
      metadata: {
        mock_payment: true,
        device_type: paymentData.deviceType,
        device_id: paymentData.deviceId,
        amount: paymentData.amount,
        currency: 'USD',
        description: paymentData.description,
        timestamp: new Date().toISOString(),
        hawaii_processed: true
      }
    };
  }
}

// Factory function to create appropriate payment processor
export function createPaymentProcessor() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  
  if (!secretKey || secretKey === 'sk_test_demo_mode') {
    console.log('🔄 Creating mock payment processor for demo mode');
    return new MockPaymentGateway();
  }
  
  console.log('💳 Creating Stripe payment processor');
  return new UPPStripeProcessor();
}
