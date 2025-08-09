
import { z } from 'zod';
import crypto from 'crypto';

import { visaDirectProcessor, VisaPaymentResult } from './visa-direct-processor.js';
import { multiCurrencySystem } from './multi-currency.js';
import { auditTrail } from '../compliance/audit-trail.js';
import secureLogger from '../shared/logger.js';
import { db } from '../database/connection.js';

// Payment schemas
export const PaymentRequestSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3),
  description: z.string(),
  merchant_id: z.string(),
  customer_email: z.string().email().optional(),
  customer_name: z.string().optional(),
  payment_method: z.enum(['card', 'bank_transfer', 'digital_wallet']),
  card_data: z.object({
    number: z.string().optional(),
    exp_month: z.string().optional(),
    exp_year: z.string().optional(),
    cvv: z.string().optional(),
    token: z.string().optional(),
    holder_name: z.string().optional()
  }).optional(),
  metadata: z.record(z.any()).optional(),
  location: z.object({
    lat: z.number().optional(),
    lng: z.number().optional(),
    address: z.string().optional()
  }).optional()
});

export const DevicePaymentSchema = z.object({
  amount: z.number().positive(),
  device_type: z.string(),
  device_id: z.string(),
  description: z.string(),
  customer_email: z.string().email().optional(),
  customer_name: z.string().optional(),
  card_data: z.object({
    number: z.string().optional(),
    token: z.string().optional(),
    exp_month: z.string().optional(),
    exp_year: z.string().optional(),
    cvv: z.string().optional()
  }).optional(),
  metadata: z.record(z.any()).optional()
});

export type PaymentRequest = z.infer<typeof PaymentRequestSchema>;
export type DevicePaymentRequest = z.infer<typeof DevicePaymentSchema>;

export interface PaymentResult {
  success: boolean;
  transaction_id: string;
  amount: number;
  currency: string;
  status: 'completed' | 'failed' | 'pending' | 'declined';
  payment_method: string;
  processing_fee?: number;
  interchange_fee?: number;
  net_amount?: number;
  approval_code?: string;
  receipt_data?: {
    transaction_id: string;
    amount: number;
    currency: string;
    description: string;
    timestamp: string;
    merchant_id: string;
    last_four?: string;
    payment_method: string;
    fees?: {
      processing: number;
      interchange: number;
      total: number;
    };
    [key: string]: any;
  };
  error_message?: string;
}

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'processing' | 'succeeded' | 'canceled';
  client_secret: string;
  customer_email?: string;
  description?: string;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface Customer {
  id: string;
  email: string;
  name?: string;
  created_at: Date;
  payment_methods: PaymentMethod[];
  metadata?: Record<string, any>;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account';
  card?: {
    last_four: string;
    brand: string;
    exp_month: string;
    exp_year: string;
    fingerprint: string;
    token: string;
  };
  bank_account?: {
    last_four: string;
    bank_name: string;
    account_type: 'checking' | 'savings';
  };
  created_at: Date;
}

export class UniversalPaymentGateway {
  private static instance: UniversalPaymentGateway;
  private paymentIntents = new Map<string, PaymentIntent>();
  private customers = new Map<string, Customer>();
  private paymentMethods = new Map<string, PaymentMethod>();

  private constructor() {
    secureLogger.info('Universal Payment Gateway initialized');
  }

  public static getInstance(): UniversalPaymentGateway {
    if (!UniversalPaymentGateway.instance) {
      UniversalPaymentGateway.instance = new UniversalPaymentGateway();
    }
    return UniversalPaymentGateway.instance;
  }

  /**
   * Process standard payment request
   */
  public async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    const startTime = Date.now();
    const transactionId = `txn_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;
    
    try {
      // Validate request
      const validatedRequest = PaymentRequestSchema.parse(request);
      
      secureLogger.info('Processing payment', {
        transactionId,
        amount: validatedRequest.amount,
        currency: validatedRequest.currency,
        paymentMethod: validatedRequest.payment_method
      });

      // Store transaction in database
      await this.storeTransaction({
        id: transactionId,
        amount: validatedRequest.amount,
        currency: validatedRequest.currency,
        description: validatedRequest.description,
        merchant_id: validatedRequest.merchant_id,
        customer_email: validatedRequest.customer_email,
        payment_method: validatedRequest.payment_method,
        status: 'processing',
        created_at: new Date(),
        metadata: validatedRequest.metadata
      });

      let paymentResult: PaymentResult;

      // Route to appropriate payment processor
      switch (validatedRequest.payment_method) {
        case 'card':
          paymentResult = await this.processCardPayment(validatedRequest, transactionId);
          break;
        case 'bank_transfer':
          paymentResult = await this.processBankTransfer(validatedRequest, transactionId);
          break;
        case 'digital_wallet':
          paymentResult = await this.processDigitalWallet(validatedRequest, transactionId);
          break;
        default:
          throw new Error(`Unsupported payment method: ${validatedRequest.payment_method}`);
      }

      // Update transaction status
      await this.updateTransactionStatus(transactionId, paymentResult.status, paymentResult);

      // Log audit trail
      await auditTrail.logPaymentEvent({
        user_id: validatedRequest.customer_email || 'anonymous',
        action: paymentResult.success ? 'payment_success' : 'payment_failure',
        transaction_id: transactionId,
        amount: validatedRequest.amount,
        currency: validatedRequest.currency,
        ip_address: '127.0.0.1',
        correlation_id: transactionId,
      });

      const processingTime = Date.now() - startTime;
      secureLogger.info('Payment processed', {
        transactionId,
        success: paymentResult.success,
        processingTime,
        status: paymentResult.status
      });

      return paymentResult;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      secureLogger.error('Payment processing failed', {
        transactionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime
      });

      // Update transaction as failed
      await this.updateTransactionStatus(transactionId, 'failed', null, error instanceof Error ? error.message : 'Unknown error');

      return {
        success: false,
        transaction_id: transactionId,
        amount: request.amount,
        currency: request.currency,
        status: 'failed',
        payment_method: request.payment_method,
        error_message: error instanceof Error ? error.message : 'Payment processing failed'
      };
    }
  }

  /**
   * Process device-specific payment
   */
  public async processDevicePayment(request: DevicePaymentRequest): Promise<PaymentResult> {
    const transactionId = `device_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;
    
    try {
      // Validate request
      const validatedRequest = DevicePaymentSchema.parse(request);
      
      secureLogger.info('Processing device payment', {
        transactionId,
        deviceType: validatedRequest.device_type,
        deviceId: validatedRequest.device_id,
        amount: validatedRequest.amount
      });

      // Convert to standard payment request
      const paymentRequest: PaymentRequest = {
        amount: validatedRequest.amount,
        currency: 'USD', // Default currency for device payments
        description: validatedRequest.description,
        merchant_id: 'UPP_DEVICE_MERCHANT',
        customer_email: validatedRequest.customer_email,
        customer_name: validatedRequest.customer_name,
        payment_method: 'card',
        card_data: validatedRequest.card_data,
        metadata: {
          device_type: validatedRequest.device_type,
          device_id: validatedRequest.device_id,
          ...validatedRequest.metadata
        }
      };

      // Process using standard payment flow
      const result = await this.processPayment(paymentRequest);
      
      // Update transaction ID to device-specific format
      result.transaction_id = transactionId;
      
      return result;

    } catch (error) {
      secureLogger.error('Device payment processing failed', {
        transactionId,
        deviceType: request.device_type,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        transaction_id: transactionId,
        amount: request.amount,
        currency: 'USD',
        status: 'failed',
        payment_method: 'card',
        error_message: error instanceof Error ? error.message : 'Device payment processing failed'
      };
    }
  }

  /**
   * Create payment intent (Stripe-like functionality)
   */
  public async createPaymentIntent(data: {
    amount: number;
    currency: string;
    customer_email?: string;
    description?: string;
    metadata?: Record<string, any>;
  }): Promise<PaymentIntent> {
    const intentId = `pi_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;
    const clientSecret = `${intentId}_secret_${crypto.randomUUID().substring(0, 16)}`;
    
    const intent: PaymentIntent = {
      id: intentId,
      amount: data.amount,
      currency: data.currency,
      status: 'requires_payment_method',
      client_secret: clientSecret,
      customer_email: data.customer_email,
      description: data.description,
      metadata: data.metadata,
      created_at: new Date(),
      updated_at: new Date()
    };

    this.paymentIntents.set(intentId, intent);
    
    // Store in database
    await this.storePaymentIntent(intent);
    
    secureLogger.info('Payment intent created', {
      intentId,
      amount: data.amount,
      currency: data.currency
    });

    return intent;
  }

  /**
   * Confirm payment intent
   */
  public async confirmPaymentIntent(intentId: string, paymentMethodData?: {
    card?: {
      number: string;
      exp_month: string;
      exp_year: string;
      cvv: string;
    };
  }): Promise<PaymentIntent> {
    const intent = this.paymentIntents.get(intentId);
    if (!intent) {
      throw new Error(`Payment intent not found: ${intentId}`);
    }

    if (intent.status !== 'requires_payment_method' && intent.status !== 'requires_confirmation') {
      throw new Error(`Payment intent cannot be confirmed in status: ${intent.status}`);
    }

    try {
      intent.status = 'processing';
      intent.updated_at = new Date();
      
      // Process the payment using Visa Direct
      if (paymentMethodData?.card) {
        const paymentRequest: PaymentRequest = {
          amount: intent.amount,
          currency: intent.currency,
          description: intent.description || 'Payment via UPP',
          merchant_id: 'UPP_INTENT_MERCHANT',
          customer_email: intent.customer_email,
          payment_method: 'card',
          card_data: paymentMethodData.card,
          metadata: intent.metadata
        };

        const result = await this.processPayment(paymentRequest);
        
        if (result.success) {
          intent.status = 'succeeded';
        } else {
          intent.status = 'requires_payment_method';
          throw new Error(result.error_message || 'Payment failed');
        }
      }

      intent.updated_at = new Date();
      await this.updatePaymentIntent(intent);

      return intent;

    } catch (error) {
      intent.status = 'requires_payment_method';
      intent.updated_at = new Date();
      
      secureLogger.error('Payment intent confirmation failed', {
        intentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  /**
   * Create customer
   */
  public async createCustomer(data: {
    email: string;
    name?: string;
    metadata?: Record<string, any>;
  }): Promise<Customer> {
    const customerId = `cus_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;
    
    const customer: Customer = {
      id: customerId,
      email: data.email,
      name: data.name,
      created_at: new Date(),
      payment_methods: [],
      metadata: data.metadata
    };

    this.customers.set(customerId, customer);
    await this.storeCustomer(customer);

    secureLogger.info('Customer created', {
      customerId,
      email: data.email,
      name: data.name
    });

    return customer;
  }

  /**
   * Create payment method and tokenize card
   */
  public async createPaymentMethod(data: {
    type: 'card';
    customer_id?: string;
    card: {
      number: string;
      exp_month: string;
      exp_year: string;
      cvv?: string;
      holder_name?: string;
    };
  }): Promise<PaymentMethod> {
    const paymentMethodId = `pm_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;
    
    try {
      // Tokenize card using Visa
      const cardToken = await visaDirectProcessor.tokenizeCard({
        pan: data.card.number,
        exp_month: data.card.exp_month,
        exp_year: data.card.exp_year,
        cvv: data.card.cvv,
        cardholder_name: data.card.holder_name
      });

      const paymentMethod: PaymentMethod = {
        id: paymentMethodId,
        type: 'card',
        card: {
          last_four: data.card.number.slice(-4),
          brand: 'VISA',
          exp_month: data.card.exp_month,
          exp_year: data.card.exp_year,
          fingerprint: crypto.createHash('sha256').update(data.card.number).digest('hex').substring(0, 16),
          token: cardToken.token
        },
        created_at: new Date()
      };

      this.paymentMethods.set(paymentMethodId, paymentMethod);
      await this.storePaymentMethod(paymentMethod);

      // Associate with customer if provided
      if (data.customer_id) {
        const customer = this.customers.get(data.customer_id);
        if (customer) {
          customer.payment_methods.push(paymentMethod);
          await this.updateCustomer(customer);
        }
      }

      secureLogger.info('Payment method created', {
        paymentMethodId,
        lastFour: paymentMethod.card?.last_four,
        brand: paymentMethod.card?.brand
      });

      return paymentMethod;

    } catch (error) {
      secureLogger.error('Payment method creation failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Process refund
   */
  public async processRefund(data: {
    payment_intent_id?: string;
    transaction_id?: string;
    amount?: number;
    reason?: string;
  }): Promise<{
    id: string;
    amount: number;
    currency: string;
    status: 'succeeded' | 'failed';
    reason?: string;
  }> {
    const refundId = `re_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;
    
    try {
      // Get original transaction
      const originalTransaction = await this.getTransaction(data.transaction_id || data.payment_intent_id || '');
      if (!originalTransaction) {
        throw new Error('Original transaction not found');
      }

      const refundAmount = data.amount || originalTransaction.amount;
      
      secureLogger.info('Processing refund', {
        refundId,
        originalTransactionId: originalTransaction.id,
        amount: refundAmount,
        currency: originalTransaction.currency
      });

      // Process refund through Visa
      const refundResult = await visaDirectProcessor.processRefund({
        original_transaction_id: originalTransaction.id,
        amount: refundAmount,
        currency: originalTransaction.currency,
        reason: data.reason
      });

      const refund = {
        id: refundId,
        amount: refundAmount,
        currency: originalTransaction.currency,
        status: refundResult.success ? 'succeeded' : 'failed' as 'succeeded' | 'failed',
        reason: data.reason
      };

      // Store refund in database
      await this.storeRefund({
        ...refund,
        original_transaction_id: originalTransaction.id,
        created_at: new Date()
      });

      return refund;

    } catch (error) {
      secureLogger.error('Refund processing failed', {
        refundId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        id: refundId,
        amount: data.amount || 0,
        currency: 'USD',
        status: 'failed',
        reason: error instanceof Error ? error.message : 'Refund failed'
      };
    }
  }

  // Private helper methods

  private async processCardPayment(request: PaymentRequest, transactionId: string): Promise<PaymentResult> {
    if (!request.card_data) {
      throw new Error('Card data required for card payment');
    }

    // Use tokenized card if available, otherwise use direct card data
    if (request.card_data.token) {
      // Process using existing token
      const result = await visaDirectProcessor.processTokenPayment({
        amount: request.amount,
        currency: request.currency,
        payment_token: request.card_data.token,
        merchant_id: request.merchant_id,
        transaction_id: transactionId,
        cvv: request.card_data.cvv
      });

      return this.convertVisaResultToPaymentResult(result, 'card');
    } else if (request.card_data.number) {
      // First tokenize the card, then process
      const cardToken = await visaDirectProcessor.tokenizeCard({
        pan: request.card_data.number,
        exp_month: request.card_data.exp_month || '',
        exp_year: request.card_data.exp_year || '',
        cvv: request.card_data.cvv,
        cardholder_name: request.card_data.holder_name
      });

      // Process payment using the new token
      const result = await visaDirectProcessor.processTokenPayment({
        amount: request.amount,
        currency: request.currency,
        payment_token: cardToken.token,
        merchant_id: request.merchant_id,
        transaction_id: transactionId,
        cvv: request.card_data.cvv
      });

      return this.convertVisaResultToPaymentResult(result, 'card');
    } else {
      throw new Error('Invalid card data provided');
    }
  }

  private async processBankTransfer(request: PaymentRequest, transactionId: string): Promise<PaymentResult> {
    // Placeholder for bank transfer processing
    // In production, this would integrate with ACH or wire transfer APIs
    
    secureLogger.info('Processing bank transfer (simulated)', {
      transactionId,
      amount: request.amount,
      currency: request.currency
    });

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Simulate 95% success rate
    const success = Math.random() > 0.05;

    return {
      success,
      transaction_id: transactionId,
      amount: request.amount,
      currency: request.currency,
      status: success ? 'completed' : 'failed',
      payment_method: 'bank_transfer',
      processing_fee: 0.25, // Flat fee for bank transfers
      net_amount: request.amount - 0.25,
      receipt_data: {
        transaction_id: transactionId,
        amount: request.amount,
        currency: request.currency,
        description: request.description,
        timestamp: new Date().toISOString(),
        merchant_id: request.merchant_id,
        payment_method: 'bank_transfer',
        fees: {
          processing: 0.25,
          interchange: 0,
          total: 0.25
        }
      },
      error_message: success ? undefined : 'Bank transfer declined'
    };
  }

  private async processDigitalWallet(request: PaymentRequest, transactionId: string): Promise<PaymentResult> {
    // Placeholder for digital wallet processing
    // In production, this would integrate with Apple Pay, Google Pay, etc.
    
    secureLogger.info('Processing digital wallet payment (simulated)', {
      transactionId,
      amount: request.amount,
      currency: request.currency
    });

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Simulate 97% success rate
    const success = Math.random() > 0.03;

    return {
      success,
      transaction_id: transactionId,
      amount: request.amount,
      currency: request.currency,
      status: success ? 'completed' : 'failed',
      payment_method: 'digital_wallet',
      processing_fee: request.amount * 0.02, // 2% fee
      net_amount: request.amount * 0.98,
      receipt_data: {
        transaction_id: transactionId,
        amount: request.amount,
        currency: request.currency,
        description: request.description,
        timestamp: new Date().toISOString(),
        merchant_id: request.merchant_id,
        payment_method: 'digital_wallet',
        fees: {
          processing: request.amount * 0.02,
          interchange: 0,
          total: request.amount * 0.02
        }
      },
      error_message: success ? undefined : 'Digital wallet payment declined'
    };
  }

  private convertVisaResultToPaymentResult(visaResult: VisaPaymentResult, paymentMethod: string): PaymentResult {
    return {
      success: visaResult.success,
      transaction_id: visaResult.transaction_id,
      amount: visaResult.amount,
      currency: visaResult.currency,
      status: visaResult.status === 'approved' ? 'completed' : 
             visaResult.status === 'declined' ? 'declined' : 
             visaResult.status === 'pending' ? 'pending' : 'failed',
      payment_method: paymentMethod,
      processing_fee: visaResult.processing_fee,
      interchange_fee: visaResult.interchange_fee,
      net_amount: visaResult.amount - (visaResult.processing_fee || 0) - (visaResult.interchange_fee || 0),
      approval_code: visaResult.approval_code,
      receipt_data: {
        transaction_id: visaResult.transaction_id,
        amount: visaResult.amount,
        currency: visaResult.currency,
        description: 'UPP Payment',
        timestamp: new Date().toISOString(),
        merchant_id: 'UPP_MERCHANT',
        payment_method: paymentMethod,
        approval_code: visaResult.approval_code,
        visa_transaction_id: visaResult.visa_transaction_id,
        fees: {
          processing: visaResult.processing_fee || 0,
          interchange: visaResult.interchange_fee || 0,
          total: (visaResult.processing_fee || 0) + (visaResult.interchange_fee || 0)
        }
      },
      error_message: visaResult.error_message
    };
  }

  // Database operations
  private async storeTransaction(transaction: any): Promise<void> {
    const query = `
      INSERT INTO transactions (id, amount, currency, description, merchant_id, customer_email, payment_method, status, created_at, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;
    
    await db.query(query, [
      transaction.id,
      transaction.amount,
      transaction.currency,
      transaction.description,
      transaction.merchant_id,
      transaction.customer_email,
      transaction.payment_method,
      transaction.status,
      transaction.created_at,
      JSON.stringify(transaction.metadata || {})
    ]);
  }

  private async updateTransactionStatus(transactionId: string, status: string, result?: PaymentResult | null, errorMessage?: string): Promise<void> {
    const query = `
      UPDATE transactions 
      SET status = $1, updated_at = $2, result = $3, error_message = $4
      WHERE id = $5
    `;
    
    await db.query(query, [
      status,
      new Date(),
      result ? JSON.stringify(result) : null,
      errorMessage,
      transactionId
    ]);
  }

  private async getTransaction(transactionId: string): Promise<any> {
    const query = 'SELECT * FROM transactions WHERE id = $1';
    const result = await db.query(query, [transactionId]);
    return result.rows[0];
  }

  private async storePaymentIntent(intent: PaymentIntent): Promise<void> {
    const query = `
      INSERT INTO payment_intents (id, amount, currency, status, client_secret, customer_email, description, metadata, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;
    
    await db.query(query, [
      intent.id,
      intent.amount,
      intent.currency,
      intent.status,
      intent.client_secret,
      intent.customer_email,
      intent.description,
      JSON.stringify(intent.metadata || {}),
      intent.created_at,
      intent.updated_at
    ]);
  }

  private async updatePaymentIntent(intent: PaymentIntent): Promise<void> {
    const query = `
      UPDATE payment_intents 
      SET status = $1, updated_at = $2
      WHERE id = $3
    `;
    
    await db.query(query, [intent.status, intent.updated_at, intent.id]);
  }

  private async storeCustomer(customer: Customer): Promise<void> {
    const query = `
      INSERT INTO customers (id, email, name, created_at, metadata)
      VALUES ($1, $2, $3, $4, $5)
    `;
    
    await db.query(query, [
      customer.id,
      customer.email,
      customer.name,
      customer.created_at,
      JSON.stringify(customer.metadata || {})
    ]);
  }

  private async updateCustomer(customer: Customer): Promise<void> {
    const query = `
      UPDATE customers 
      SET name = $1, metadata = $2
      WHERE id = $3
    `;
    
    await db.query(query, [
      customer.name,
      JSON.stringify(customer.metadata || {}),
      customer.id
    ]);
  }

  private async storePaymentMethod(paymentMethod: PaymentMethod): Promise<void> {
    const query = `
      INSERT INTO payment_methods (id, type, card_data, bank_account_data, created_at)
      VALUES ($1, $2, $3, $4, $5)
    `;
    
    await db.query(query, [
      paymentMethod.id,
      paymentMethod.type,
      paymentMethod.card ? JSON.stringify(paymentMethod.card) : null,
      paymentMethod.bank_account ? JSON.stringify(paymentMethod.bank_account) : null,
      paymentMethod.created_at
    ]);
  }

  private async storeRefund(refund: any): Promise<void> {
    const query = `
      INSERT INTO refunds (id, amount, currency, status, reason, original_transaction_id, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    
    await db.query(query, [
      refund.id,
      refund.amount,
      refund.currency,
      refund.status,
      refund.reason,
      refund.original_transaction_id,
      refund.created_at
    ]);
  }
}

// Export singleton instance
export const universalPaymentGateway = UniversalPaymentGateway.getInstance();
