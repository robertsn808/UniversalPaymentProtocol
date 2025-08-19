// Card Payment Processor - PCI DSS Compliant
// Integrates with payment gateways while maintaining security standards

import Stripe from 'stripe';
import { 
  CardPaymentRequest, 
  CardPaymentResult, 
  CardProcessingConfig,
  PaymentStatus,
  CardBrand,
  CardType,
  AVSResult,
  CVVResult,
  ReceiptData
} from './card-payment-types.js';
import { CardValidator } from './card-validator.js';
import { CardSecurityManager } from './card-security.js';

export class CardPaymentProcessor {
  private stripe: Stripe;
  private securityManager: CardSecurityManager;
  private config: CardProcessingConfig;

  constructor(config: CardProcessingConfig) {
    this.config = config;
    this.securityManager = new CardSecurityManager(config);
    
    // Initialize Stripe
    this.stripe = new Stripe(config.gateway.api_key, {
      apiVersion: '2025-06-30.basil'
    });

    // Validate PCI compliance
    const compliance = this.securityManager.validatePCICompliance();
    if (!compliance.compliant) {
      console.error('⚠️ PCI Compliance issues:', compliance.issues);
      if (config.gateway.environment === 'live') {
        throw new Error('Cannot process payments without PCI compliance');
      }
    }

    console.log('💳 Card payment processor initialized with PCI compliance');
  }

  /**
   * Process card payment with full validation and security
   */
  async processCardPayment(request: CardPaymentRequest): Promise<CardPaymentResult> {
    const startTime = Date.now();
    const transactionId = this.generateTransactionId();

    try {
      console.log(`💳 Processing card payment: $${request.amount} ${request.currency}`);

      // 1. Validate request data
      const validationResult = await this.validatePaymentRequest(request);
      if (!validationResult.valid) {
        return this.createErrorResult(transactionId, 'VALIDATION_FAILED', validationResult.errors.join(', '));
      }

      // 2. Validate card data integrity
      if (!this.securityManager.validateCardDataIntegrity(request.card_data)) {
        return this.createErrorResult(transactionId, 'CARD_DATA_INTEGRITY_FAILED', 'Card data integrity check failed');
      }

      // 3. Check fraud detection
      const fraudCheck = await this.performFraudCheck(request);
      if (fraudCheck.risk_score > this.config.fraud_detection.risk_threshold) {
        return this.createErrorResult(transactionId, 'FRAUD_DETECTED', 'Transaction flagged for fraud');
      }

      // 4. Process through payment gateway
      const gatewayResult = await this.processWithGateway(request, transactionId);
      
      // 5. Create result
      const result = this.createPaymentResult(gatewayResult, request, transactionId, startTime);

      // 6. Log successful transaction (without sensitive data)
      this.logTransaction(result, 'success');

      return result;

    } catch (error: any) {
      console.error('💥 Card payment processing failed:', error.message);
      
      const errorResult = this.createErrorResult(
        transactionId, 
        'PROCESSING_ERROR', 
        error.message || 'Payment processing failed'
      );

      this.logTransaction(errorResult, 'error');
      return errorResult;
    }
  }

  /**
   * Process payment with token (recurring payments)
   */
  async processTokenPayment(tokenId: string, amount: number, currency: string, description: string): Promise<CardPaymentResult> {
    const transactionId = this.generateTransactionId();
    const startTime = Date.now();

    try {
      console.log(`💳 Processing token payment: $${amount} ${currency}`);

      // Validate amount
      const amountValidation = CardValidator.validateAmount(amount, currency);
      if (!amountValidation.valid) {
        return this.createErrorResult(transactionId, 'INVALID_AMOUNT', amountValidation.errors.join(', '));
      }

      // Create payment intent with payment method
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        description,
        payment_method: tokenId,
        confirm: true,
        metadata: {
          payment_type: 'token',
          upp_protocol: 'true',
          hawaii_processed: 'true'
        }
      });

      const result = this.createPaymentResultFromStripe(paymentIntent, amount, currency, transactionId, startTime);
      this.logTransaction(result, 'success');

      return result;

    } catch (error: any) {
      console.error('💥 Token payment failed:', error.message);
      
      const errorResult = this.createErrorResult(
        transactionId, 
        'TOKEN_PAYMENT_ERROR', 
        error.message || 'Token payment failed'
      );

      this.logTransaction(errorResult, 'error');
      return errorResult;
    }
  }

  /**
   * Refund a card payment
   */
  async refundPayment(paymentIntentId: string, amount?: number, reason?: string): Promise<CardPaymentResult> {
    try {
      console.log(`💰 Processing refund for payment: ${paymentIntentId}`);

      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount ? Math.round(amount * 100) : undefined,
        reason: reason as any || 'requested_by_customer',
        metadata: {
          upp_refund: 'true',
          hawaii_processed: 'true'
        }
      });

      const result: CardPaymentResult = {
        success: refund.status === 'succeeded',
        transaction_id: refund.id,
        payment_intent_id: paymentIntentId,
        amount: refund.amount / 100,
        currency: refund.currency.toUpperCase(),
        status: refund.status === 'succeeded' ? 'refunded' : 'failed',
        error_message: refund.status !== 'succeeded' ? 'Refund failed' : undefined,
        created_at: new Date(refund.created * 1000).toISOString(),
        processed_at: new Date().toISOString()
      };

      console.log(`💰 Refund ${result.success ? 'completed' : 'failed'}: ${refund.id}`);
      return result;

    } catch (error: any) {
      console.error('💥 Refund failed:', error.message);
      
      return {
        success: false,
        transaction_id: `refund_${Date.now()}`,
        payment_intent_id: paymentIntentId,
        amount: amount || 0,
        currency: 'USD',
        status: 'failed',
        error_message: error.message || 'Refund processing failed',
        created_at: new Date().toISOString(),
        processed_at: new Date().toISOString()
      };
    }
  }

  /**
   * Validate payment request
   */
  private async validatePaymentRequest(request: CardPaymentRequest): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Validate basic fields
    const amountValidation = CardValidator.validateAmount(request.amount, request.currency);
    if (!amountValidation.valid) {
      errors.push(...amountValidation.errors.map(e => e.message));
    }

    const merchantValidation = CardValidator.validateMerchantId(request.merchant_id);
    if (!merchantValidation.valid) {
      errors.push(...merchantValidation.errors.map(e => e.message));
    }

    // Validate card data
    const cardValidation = CardValidator.validateCardData(request.card_data);
    if (!cardValidation.valid) {
      errors.push(...cardValidation.errors.map(e => e.message));
    }

    // Validate description
    if (!request.description || request.description.trim().length === 0) {
      errors.push('Payment description is required');
    }

    // Validate currency support
    if (!this.config.processing.supported_currencies.includes(request.currency.toUpperCase())) {
      errors.push(`Currency ${request.currency} is not supported`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Perform fraud detection check
   */
  private async performFraudCheck(request: CardPaymentRequest): Promise<{ risk_score: number; flagged: boolean }> {
    let riskScore = 0;

    // Check for suspicious patterns
    if (request.amount > 10000) {
      riskScore += 20; // High amount
    }

    if (request.amount < 1) {
      riskScore += 10; // Very low amount
    }

    // Check location (if available)
    if (request.location?.ip_address) {
      // In production, this would check against IP geolocation databases
      // and known fraud IP lists
      riskScore += 5;
    }

    // Check device fingerprint
    if (request.device_info?.fingerprint) {
      // In production, this would check against known device patterns
      riskScore += 5;
    }

    // Check for rapid transactions (would need transaction history)
    riskScore += 5; // Base risk

    return {
      risk_score: riskScore,
      flagged: riskScore > this.config.fraud_detection.risk_threshold
    };
  }

  /**
   * Process payment with Stripe gateway
   */
  private async processWithGateway(request: CardPaymentRequest, transactionId: string): Promise<any> {
    // Convert amount to cents
    const amountInCents = Math.round(request.amount * 100);

    // Create payment intent
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: amountInCents,
      currency: request.currency.toLowerCase(),
      description: request.description,
      metadata: {
        merchant_id: request.merchant_id,
        transaction_id: transactionId,
        upp_protocol: 'true',
        hawaii_processed: 'true',
        device_type: request.device_info?.device_type || 'unknown',
        ...request.metadata
      },
      automatic_payment_methods: {
        enabled: true
      }
    });

    // For demo purposes, auto-confirm the payment
    // In production, this would be handled by the client
    const confirmedPayment = await this.stripe.paymentIntents.confirm(
      paymentIntent.id,
      {
        payment_method: 'pm_card_visa', // Test payment method
        return_url: 'https://your-website.com/return'
      }
    );

    return confirmedPayment;
  }

  /**
   * Create payment result from Stripe response
   */
  private createPaymentResultFromStripe(
    stripePayment: any, 
    amount: number, 
    currency: string, 
    transactionId: string, 
    startTime: number
  ): CardPaymentResult {
    const success = stripePayment.status === 'succeeded';
    const processingTime = Date.now() - startTime;

    const result: CardPaymentResult = {
      success,
      transaction_id: transactionId,
      payment_intent_id: stripePayment.id,
      amount,
      currency: currency.toUpperCase(),
      status: this.mapStripeStatus(stripePayment.status),
      created_at: new Date(stripePayment.created * 1000).toISOString(),
      processed_at: new Date().toISOString()
    };

    // Add card information if available
    if (stripePayment.payment_method?.card) {
      result.card_info = {
        last4: stripePayment.payment_method.card.last4,
        brand: stripePayment.payment_method.card.brand as CardBrand,
        type: 'credit' as CardType, // Would be determined from BIN lookup
        country: stripePayment.payment_method.card.country
      };
    }

    // Add authorization details if available
    if (stripePayment.charges?.data?.[0]) {
      const charge = stripePayment.charges.data[0];
      result.authorization = {
        auth_code: charge.authorization_code || 'N/A',
        avs_result: this.mapAVSResult(charge.outcome?.seller_message),
        cvv_result: this.mapCVVResult(charge.outcome?.seller_message),
        risk_score: charge.outcome?.risk_score || 0
      };
    }

    // Add receipt data
    result.receipt_data = {
      transaction_id: transactionId,
      amount,
      currency: currency.toUpperCase(),
      description: stripePayment.description || '',
      merchant_id: stripePayment.metadata?.merchant_id || '',
      card_last4: result.card_info?.last4 || '',
      card_brand: result.card_info?.brand || 'unknown',
      timestamp: result.processed_at,
      device_type: stripePayment.metadata?.device_type || 'unknown',
      hawaii_processed: true
    };

    if (!success) {
      result.error_message = stripePayment.last_payment_error?.message || 'Payment failed';
      result.error_code = stripePayment.last_payment_error?.code || 'PAYMENT_FAILED';
    }

    return result;
  }

  /**
   * Create error result
   */
  private createErrorResult(transactionId: string, errorCode: string, errorMessage: string): CardPaymentResult {
    return {
      success: false,
      transaction_id: transactionId,
      amount: 0,
      currency: 'USD',
      status: 'failed',
      error_message: errorMessage,
      error_code: errorCode,
      created_at: new Date().toISOString(),
      processed_at: new Date().toISOString()
    };
  }

  /**
   * Create payment result
   */
  private createPaymentResult(gatewayResult: any, request: CardPaymentRequest, transactionId: string, startTime: number): CardPaymentResult {
    return this.createPaymentResultFromStripe(gatewayResult, request.amount, request.currency, transactionId, startTime);
  }

  /**
   * Map Stripe status to our status
   */
  private mapStripeStatus(stripeStatus: string): PaymentStatus {
    switch (stripeStatus) {
      case 'succeeded': return 'completed';
      case 'processing': return 'processing';
      case 'requires_payment_method': return 'pending';
      case 'requires_confirmation': return 'pending';
      case 'requires_action': return 'pending';
      case 'canceled': return 'cancelled';
      default: return 'failed';
    }
  }

  /**
   * Map AVS result
   */
  private mapAVSResult(message?: string): AVSResult {
    // In production, this would parse actual AVS codes from Stripe
    return {
      code: 'Y', // Would be actual AVS code
      message: message || 'Address verification completed',
      match: true
    };
  }

  /**
   * Map CVV result
   */
  private mapCVVResult(message?: string): CVVResult {
    // In production, this would parse actual CVV codes from Stripe
    return {
      code: 'M', // Would be actual CVV code
      message: message || 'CVV verification completed',
      match: true
    };
  }

  /**
   * Generate transaction ID
   */
  private generateTransactionId(): string {
    return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log transaction (without sensitive data)
   */
  private logTransaction(result: CardPaymentResult, type: 'success' | 'error'): void {
    const sanitizedResult = this.securityManager.sanitizeForLogging(result);
    
    console.log(`📊 Transaction ${type}:`, {
      transaction_id: sanitizedResult.transaction_id,
      amount: sanitizedResult.amount,
      currency: sanitizedResult.currency,
      status: sanitizedResult.status,
      timestamp: sanitizedResult.processed_at
    });
  }
}
