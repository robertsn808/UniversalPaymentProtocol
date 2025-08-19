
import crypto from 'crypto';
import https from 'https';
import fs from 'fs';
import { env } from '../config/environment.js';
import secureLogger from '../shared/logger.js';

export interface VisaTokenizationRequest {
  pan: string;
  exp_month: string;
  exp_year: string;
  cvv?: string;
  cardholder_name?: string;
}

export interface VisaTokenizationResult {
  success: boolean;
  token: string;
  last_four: string;
  brand: string;
  fingerprint: string;
  error_message?: string;
}

export interface VisaPaymentRequest {
  amount: number;
  currency: string;
  payment_token: string;
  merchant_id: string;
  transaction_id: string;
  cvv?: string;
}

export interface VisaPaymentResult {
  success: boolean;
  transaction_id: string;
  visa_transaction_id?: string;
  amount: number;
  currency: string;
  status: 'approved' | 'declined' | 'pending' | 'failed';
  approval_code?: string;
  processing_fee?: number;
  interchange_fee?: number;
  error_message?: string;
  response_code?: string;
  response_message?: string;
}

export interface VisaRefundRequest {
  original_transaction_id: string;
  amount: number;
  currency: string;
  reason?: string;
}

export interface VisaRefundResult {
  success: boolean;
  refund_id: string;
  amount: number;
  currency: string;
  status: 'approved' | 'declined' | 'pending';
  error_message?: string;
}

class VisaDirectProcessor {
  private static instance: VisaDirectProcessor;
  private apiBaseUrl: string;
  private userId: string;
  private password: string;
  private certPath: string;
  private keyPath: string;
  private isDemoMode: boolean;

  // In-memory storage for demo mode
  private demoTokens = new Map<string, any>();
  private demoTransactions = new Map<string, any>();

  private constructor() {
    this.apiBaseUrl = env.VISA_API_BASE_URL;
    this.userId = env.VISA_USER_ID;
    this.password = env.VISA_PASSWORD;
    this.certPath = env.VISA_CERT_PATH;
    this.keyPath = env.VISA_KEY_PATH;
    this.isDemoMode = this.userId === 'demo_mode' || this.password === 'demo_mode';

    if (this.isDemoMode) {
      secureLogger.info('Visa Direct processor initialized in demo mode');
    } else {
      secureLogger.info('Visa Direct processor initialized with live credentials');
    }
  }

  public static getInstance(): VisaDirectProcessor {
    if (!VisaDirectProcessor.instance) {
      VisaDirectProcessor.instance = new VisaDirectProcessor();
    }
    return VisaDirectProcessor.instance;
  }

  /**
   * Tokenize card data for secure storage
   */
  public async tokenizeCard(request: VisaTokenizationRequest): Promise<VisaTokenizationResult> {
    const correlationId = `tokenize_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;

    try {
      secureLogger.info('Tokenizing card', {
        correlationId,
        lastFour: request.pan.slice(-4),
        expMonth: request.exp_month,
        expYear: request.exp_year
      });

      if (this.isDemoMode) {
        return this.simulateTokenization(request, correlationId);
      }

      // Real Visa Direct tokenization
      const visaRequest = {
        primaryAccountNumber: request.pan,
        expirationDate: {
          month: request.exp_month,
          year: request.exp_year
        },
        cardholderName: request.cardholder_name,
        cvv2: request.cvv
      };

      const response = await this.makeVisaApiCall('/cybersource/payments/v1/tokens', 'POST', visaRequest);

      if (response.status === 'AUTHORIZED') {
        const result: VisaTokenizationResult = {
          success: true,
          token: response.token,
          last_four: request.pan.slice(-4),
          brand: this.detectCardBrand(request.pan),
          fingerprint: crypto.createHash('sha256').update(request.pan).digest('hex').substring(0, 16)
        };

        secureLogger.info('Card tokenized successfully', {
          correlationId,
          tokenId: result.token,
          lastFour: result.last_four
        });

        return result;
      } else {
        throw new Error(response.message || 'Tokenization failed');
      }

    } catch (error) {
      secureLogger.error('Card tokenization failed', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        token: '',
        last_four: request.pan.slice(-4),
        brand: this.detectCardBrand(request.pan),
        fingerprint: '',
        error_message: error instanceof Error ? error.message : 'Tokenization failed'
      };
    }
  }

  /**
   * Process payment using tokenized card
   */
  public async processTokenPayment(request: VisaPaymentRequest): Promise<VisaPaymentResult> {
    const correlationId = `payment_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;

    try {
      secureLogger.info('Processing token payment', {
        correlationId,
        transactionId: request.transaction_id,
        amount: request.amount,
        currency: request.currency,
        token: request.payment_token.substring(0, 8) + '...'
      });

      if (this.isDemoMode) {
        return this.simulatePayment(request, correlationId);
      }

      // Real Visa Direct payment processing
      const visaRequest = {
        amount: {
          value: Math.round(request.amount * 100), // Convert to cents
          currency: request.currency
        },
        paymentToken: request.payment_token,
        merchantId: request.merchant_id,
        merchantTransactionId: request.transaction_id,
        cvv2: request.cvv,
        processingOptions: {
          captureMethod: 'auto',
          paymentType: 'sale'
        }
      };

      const response = await this.makeVisaApiCall('/cybersource/payments/v1/payments', 'POST', visaRequest);

      const result: VisaPaymentResult = {
        success: response.status === 'AUTHORIZED',
        transaction_id: request.transaction_id,
        visa_transaction_id: response.id,
        amount: request.amount,
        currency: request.currency,
        status: response.status === 'AUTHORIZED' ? 'approved' : 
               response.status === 'DECLINED' ? 'declined' : 'failed',
        approval_code: response.processorInformation?.approvalCode,
        processing_fee: this.calculateProcessingFee(request.amount),
        interchange_fee: this.calculateInterchangeFee(request.amount),
        response_code: response.processorInformation?.responseCode,
        response_message: response.processorInformation?.responseDetails
      };

      if (!result.success) {
        result.error_message = response.message || 'Payment declined';
      }

      secureLogger.info('Token payment processed', {
        correlationId,
        success: result.success,
        status: result.status,
        visaTransactionId: result.visa_transaction_id
      });

      return result;

    } catch (error) {
      secureLogger.error('Token payment processing failed', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        transaction_id: request.transaction_id,
        amount: request.amount,
        currency: request.currency,
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Payment processing failed'
      };
    }
  }

  /**
   * Process refund
   */
  public async processRefund(request: VisaRefundRequest): Promise<VisaRefundResult> {
    const correlationId = `refund_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;
    const refundId = `rf_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;

    try {
      secureLogger.info('Processing refund', {
        correlationId,
        refundId,
        originalTransactionId: request.original_transaction_id,
        amount: request.amount,
        currency: request.currency
      });

      if (this.isDemoMode) {
        return this.simulateRefund(request, refundId, correlationId);
      }

      // Real Visa Direct refund processing
      const visaRequest = {
        amount: {
          value: Math.round(request.amount * 100),
          currency: request.currency
        },
        originalTransactionId: request.original_transaction_id,
        reason: request.reason || 'Customer request'
      };

      const response = await this.makeVisaApiCall('/cybersource/payments/v1/refunds', 'POST', visaRequest);

      const result: VisaRefundResult = {
        success: response.status === 'AUTHORIZED',
        refund_id: refundId,
        amount: request.amount,
        currency: request.currency,
        status: response.status === 'AUTHORIZED' ? 'approved' : 
               response.status === 'DECLINED' ? 'declined' : 'pending'
      };

      if (!result.success) {
        result.error_message = response.message || 'Refund declined';
      }

      return result;

    } catch (error) {
      secureLogger.error('Refund processing failed', {
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        refund_id: refundId,
        amount: request.amount,
        currency: request.currency,
        status: 'declined',
        error_message: error instanceof Error ? error.message : 'Refund failed'
      };
    }
  }

  // Demo mode simulation methods

  private async simulateTokenization(request: VisaTokenizationRequest, correlationId: string): Promise<VisaTokenizationResult> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

    const token = `tok_demo_${Date.now()}_${crypto.randomUUID().substring(0, 12)}`;
    const fingerprint = crypto.createHash('sha256').update(request.pan).digest('hex').substring(0, 16);

    // Store token data for demo
    this.demoTokens.set(token, {
      pan: request.pan,
      exp_month: request.exp_month,
      exp_year: request.exp_year,
      cardholder_name: request.cardholder_name,
      created_at: new Date()
    });

    // Simulate 99% success rate for valid cards
    const isValidCard = this.isValidCardNumber(request.pan);
    const success = isValidCard && Math.random() > 0.01;

    const result: VisaTokenizationResult = {
      success,
      token: success ? token : '',
      last_four: request.pan.slice(-4),
      brand: this.detectCardBrand(request.pan),
      fingerprint: success ? fingerprint : ''
    };

    if (!success) {
      result.error_message = !isValidCard ? 'Invalid card number' : 'Tokenization failed';
    }

    secureLogger.info('Demo tokenization completed', {
      correlationId,
      success,
      token: success ? token : 'N/A'
    });

    return result;
  }

  private async simulatePayment(request: VisaPaymentRequest, correlationId: string): Promise<VisaPaymentResult> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    // Check if token exists in demo storage
    const tokenData = this.demoTokens.get(request.payment_token);
    if (!tokenData) {
      return {
        success: false,
        transaction_id: request.transaction_id,
        amount: request.amount,
        currency: request.currency,
        status: 'failed',
        error_message: 'Invalid payment token'
      };
    }

    // Simulate different outcomes based on amount
    let success = true;
    let status: 'approved' | 'declined' | 'pending' | 'failed' = 'approved';
    let errorMessage: string | undefined;

    if (request.amount > 10000) {
      // Amounts over $100 have higher decline rate
      success = Math.random() > 0.3;
      status = success ? 'approved' : 'declined';
      errorMessage = success ? undefined : 'Transaction amount too high';
    } else if (request.amount < 1) {
      // Very small amounts are declined
      success = false;
      status = 'declined';
      errorMessage = 'Transaction amount too small';
    } else {
      // Normal amounts have 95% success rate
      success = Math.random() > 0.05;
      status = success ? 'approved' : 'declined';
      errorMessage = success ? undefined : 'Insufficient funds';
    }

    const visaTransactionId = `visa_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;
    
    const result: VisaPaymentResult = {
      success,
      transaction_id: request.transaction_id,
      visa_transaction_id: visaTransactionId,
      amount: request.amount,
      currency: request.currency,
      status,
      approval_code: success ? `APP${Math.floor(Math.random() * 1000000)}` : undefined,
      processing_fee: this.calculateProcessingFee(request.amount),
      interchange_fee: this.calculateInterchangeFee(request.amount),
      error_message: errorMessage,
      response_code: success ? '00' : '51',
      response_message: success ? 'Approved' : errorMessage
    };

    // Store transaction for demo
    this.demoTransactions.set(request.transaction_id, {
      ...result,
      token_data: tokenData,
      processed_at: new Date()
    });

    secureLogger.info('Demo payment completed', {
      correlationId,
      success,
      status,
      visaTransactionId
    });

    return result;
  }

  private async simulateRefund(request: VisaRefundRequest, refundId: string, correlationId: string): Promise<VisaRefundResult> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));

    // Check if original transaction exists
    const originalTransaction = this.demoTransactions.get(request.original_transaction_id);
    if (!originalTransaction) {
      return {
        success: false,
        refund_id: refundId,
        amount: request.amount,
        currency: request.currency,
        status: 'declined',
        error_message: 'Original transaction not found'
      };
    }

    // Simulate 98% success rate for refunds
    const success = Math.random() > 0.02;

    const result: VisaRefundResult = {
      success,
      refund_id: refundId,
      amount: request.amount,
      currency: request.currency,
      status: success ? 'approved' : 'declined',
      error_message: success ? undefined : 'Refund processing failed'
    };

    secureLogger.info('Demo refund completed', {
      correlationId,
      success,
      refundId
    });

    return result;
  }

  // Utility methods

  private async makeVisaApiCall(endpoint: string, method: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(data);
      const auth = Buffer.from(`${this.userId}:${this.password}`).toString('base64');

      const options: https.RequestOptions = {
        hostname: new URL(this.apiBaseUrl).hostname,
        path: endpoint,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json'
        }
      };

      // Add client certificates if available
      if (!this.isDemoMode && fs.existsSync(this.certPath) && fs.existsSync(this.keyPath)) {
        options.cert = fs.readFileSync(this.certPath);
        options.key = fs.readFileSync(this.keyPath);
      }

      const req = https.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            const parsedData = JSON.parse(responseData);
            resolve(parsedData);
          } catch (error) {
            reject(new Error('Invalid JSON response from Visa API'));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  }

  private detectCardBrand(pan: string): string {
    const firstDigit = pan.charAt(0);
    const firstTwoDigits = pan.substring(0, 2);
    const firstFourDigits = pan.substring(0, 4);

    if (firstDigit === '4') {
      return 'VISA';
    } else if (['51', '52', '53', '54', '55'].includes(firstTwoDigits) || 
               (parseInt(firstFourDigits) >= 2221 && parseInt(firstFourDigits) <= 2720)) {
      return 'MASTERCARD';
    } else if (['34', '37'].includes(firstTwoDigits)) {
      return 'AMEX';
    } else if (firstFourDigits === '6011' || firstTwoDigits === '65') {
      return 'DISCOVER';
    } else {
      return 'UNKNOWN';
    }
  }

  private isValidCardNumber(pan: string): boolean {
    // Luhn algorithm check
    const digits = pan.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) {
      return false;
    }

    let sum = 0;
    let isEven = false;

    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits.charAt(i));

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  private calculateProcessingFee(amount: number): number {
    // Visa Direct processing fee: 2.4% + $0.10
    return Math.round((amount * 0.024 + 0.10) * 100) / 100;
  }

  private calculateInterchangeFee(amount: number): number {
    // Typical interchange fee: 1.8%
    return Math.round((amount * 0.018) * 100) / 100;
  }

  public getDemoTransactions(): Map<string, any> {
    return this.demoTransactions;
  }

  public getDemoTokens(): Map<string, any> {
    return this.demoTokens;
  }
}

export const visaDirectProcessor = VisaDirectProcessor.getInstance();
export default visaDirectProcessor;
