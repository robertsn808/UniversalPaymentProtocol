
import { z } from 'zod';
import crypto from 'crypto';
import https from 'https';

import { auditTrail } from '../compliance/audit-trail.js';
import secureLogger from '../shared/logger.js';
import { env } from '../config/environment.js';

// Visa Direct API schemas
export const VisaDirectPaymentSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3),
  recipient_card: z.string().min(13).max(19),
  sender_card: z.string().min(13).max(19),
  merchant_id: z.string(),
  business_application_id: z.string(),
  transaction_id: z.string(),
  source_of_funds: z.enum(['01', '02', '03', '04', '05']), // Visa defined codes
  purpose_of_payment: z.string().max(255),
});

export const VisaTokenPaymentSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3),
  payment_token: z.string(),
  merchant_id: z.string(),
  transaction_id: z.string(),
  cvv: z.string().optional(),
});

export type VisaDirectPayment = z.infer<typeof VisaDirectPaymentSchema>;
export type VisaTokenPayment = z.infer<typeof VisaTokenPaymentSchema>;

export interface VisaPaymentResult {
  success: boolean;
  transaction_id: string;
  visa_transaction_id?: string;
  amount: number;
  currency: string;
  status: 'approved' | 'declined' | 'pending' | 'failed';
  approval_code?: string;
  response_code: string;
  response_message: string;
  processing_fee?: number;
  interchange_fee?: number;
  settlement_date?: string;
  error_message?: string;
  raw_response?: any;
}

export interface VisaCardToken {
  token: string;
  last_four: string;
  brand: 'VISA';
  exp_month: string;
  exp_year: string;
  created_at: Date;
  expires_at: Date;
}

export class VisaDirectProcessor {
  private static instance: VisaDirectProcessor;
  private apiBaseUrl: string;
  private userId: string;
  private password: string;
  private certificatePath: string;
  private keyPath: string;
  private isProduction: boolean;

  private constructor() {
    this.isProduction = env.NODE_ENV === 'production';
    this.apiBaseUrl = this.isProduction 
      ? 'https://api.visa.com'
      : 'https://sandbox.api.visa.com';
    
    // Get credentials from environment
    this.userId = env.VISA_USER_ID || '';
    this.password = env.VISA_PASSWORD || '';
    this.certificatePath = env.VISA_CERT_PATH || '/tmp/visa_cert.pem';
    this.keyPath = env.VISA_KEY_PATH || '/tmp/visa_key.pem';

    if (!this.userId || !this.password) {
      throw new Error('Visa Direct credentials not configured');
    }

    secureLogger.info('Visa Direct processor initialized', {
      environment: this.isProduction ? 'production' : 'sandbox',
      apiUrl: this.apiBaseUrl
    });
  }

  public static getInstance(): VisaDirectProcessor {
    if (!VisaDirectProcessor.instance) {
      VisaDirectProcessor.instance = new VisaDirectProcessor();
    }
    return VisaDirectProcessor.instance;
  }

  /**
   * Process fund transfer using Visa Direct
   */
  public async processFundTransfer(payment: VisaDirectPayment): Promise<VisaPaymentResult> {
    const startTime = Date.now();
    
    try {
      // Validate payment data
      const validatedPayment = VisaDirectPaymentSchema.parse(payment);
      
      secureLogger.info('Processing Visa Direct fund transfer', {
        transactionId: validatedPayment.transaction_id,
        amount: validatedPayment.amount,
        currency: validatedPayment.currency
      });

      // Prepare request payload
      const requestPayload = {
        acquirerCountryCode: '840', // US
        acquiringBin: '408999',
        amount: validatedPayment.amount.toFixed(2),
        businessApplicationId: validatedPayment.business_application_id,
        cardAcceptor: {
          address: {
            country: 'USA',
            county: 'San Mateo',
            state: 'CA',
            zipCode: '94404'
          },
          idCode: validatedPayment.merchant_id,
          name: 'Universal Payment Protocol',
          terminalId: 'UPP001'
        },
        localTransactionDateTime: new Date().toISOString().replace(/[-:]/g, '').slice(0, 14),
        merchantCategoryCode: '6012',
        pointOfServiceData: {
          panEntryMode: '90',
          posConditionCode: '00'
        },
        recipientName: 'UPP User',
        recipientPrimaryAccountNumber: validatedPayment.recipient_card,
        retrievalReferenceNumber: this.generateRRN(),
        senderAccountNumber: validatedPayment.sender_card,
        senderAddress: {
          country: 'USA',
          county: 'San Mateo',
          state: 'CA',
          zipCode: '94404'
        },
        senderCity: 'Foster City',
        senderCountryCode: '840',
        senderCurrencyCode: '840',
        senderName: 'UPP Sender',
        senderReference: '',
        senderStateCode: 'CA',
        sourceOfFundsCode: validatedPayment.source_of_funds,
        systemsTraceAuditNumber: this.generateSTAN(),
        transactionCurrencyCode: this.getCurrencyCode(validatedPayment.currency),
        transactionIdentifier: validatedPayment.transaction_id
      };

      // Make API request
      const response = await this.makeVisaAPIRequest(
        '/visadirect/fundstransfer/v1/pullfundstransactions',
        'POST',
        requestPayload
      );

      const processingTime = Date.now() - startTime;

      // Process response
      const result = this.processVisaResponse(response, validatedPayment, processingTime);

      // Log transaction
      await auditTrail.logPaymentEvent({
        user_id: 'system',
        action: result.success ? 'visa_payment_success' : 'visa_payment_failure',
        transaction_id: validatedPayment.transaction_id,
        amount: validatedPayment.amount,
        currency: validatedPayment.currency,
        ip_address: '127.0.0.1',
        correlation_id: validatedPayment.transaction_id,
      });

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      secureLogger.error('Visa Direct fund transfer failed', {
        transactionId: payment.transaction_id,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime
      });

      return {
        success: false,
        transaction_id: payment.transaction_id,
        amount: payment.amount,
        currency: payment.currency,
        status: 'failed',
        response_code: 'ERROR',
        response_message: error instanceof Error ? error.message : 'Payment processing failed',
        error_message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process card payment using Visa Token Service
   */
  public async processTokenPayment(payment: VisaTokenPayment): Promise<VisaPaymentResult> {
    const startTime = Date.now();
    
    try {
      // Validate payment data
      const validatedPayment = VisaTokenPaymentSchema.parse(payment);
      
      secureLogger.info('Processing Visa token payment', {
        transactionId: validatedPayment.transaction_id,
        amount: validatedPayment.amount,
        currency: validatedPayment.currency
      });

      // Prepare authorization request
      const requestPayload = {
        acquirerCountryCode: '840',
        acquiringBin: '408999',
        amount: validatedPayment.amount.toFixed(2),
        businessApplicationId: 'AA',
        cardAcceptor: {
          address: {
            country: 'USA',
            county: 'San Mateo', 
            state: 'CA',
            zipCode: '94404'
          },
          idCode: validatedPayment.merchant_id,
          name: 'Universal Payment Protocol',
          terminalId: 'UPP001'
        },
        localTransactionDateTime: new Date().toISOString().replace(/[-:]/g, '').slice(0, 14),
        merchantCategoryCode: '5999',
        pointOfServiceData: {
          panEntryMode: '81',
          posConditionCode: '59'
        },
        primaryAccountNumber: validatedPayment.payment_token,
        retrievalReferenceNumber: this.generateRRN(),
        systemsTraceAuditNumber: this.generateSTAN(),
        transactionCurrencyCode: this.getCurrencyCode(validatedPayment.currency),
        transactionIdentifier: validatedPayment.transaction_id
      };

      // Add CVV if provided
      if (validatedPayment.cvv) {
        requestPayload['cardSecurityCode'] = validatedPayment.cvv;
      }

      // Make authorization request
      const response = await this.makeVisaAPIRequest(
        '/visanetconnect/v1/authorization',
        'POST',
        requestPayload
      );

      const processingTime = Date.now() - startTime;
      
      // Process response
      const result = this.processVisaResponse(response, validatedPayment, processingTime);

      // Log transaction
      await auditTrail.logPaymentEvent({
        user_id: 'system',
        action: result.success ? 'visa_token_payment_success' : 'visa_token_payment_failure',
        transaction_id: validatedPayment.transaction_id,
        amount: validatedPayment.amount,
        currency: validatedPayment.currency,
        ip_address: '127.0.0.1',
        correlation_id: validatedPayment.transaction_id,
      });

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      secureLogger.error('Visa token payment failed', {
        transactionId: payment.transaction_id,
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime
      });

      return {
        success: false,
        transaction_id: payment.transaction_id,
        amount: payment.amount,
        currency: payment.currency,
        status: 'failed',
        response_code: 'ERROR',
        response_message: error instanceof Error ? error.message : 'Payment processing failed',
        error_message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Tokenize card for future use
   */
  public async tokenizeCard(cardData: {
    pan: string;
    exp_month: string;
    exp_year: string;
    cvv?: string;
    cardholder_name?: string;
  }): Promise<VisaCardToken> {
    try {
      secureLogger.info('Tokenizing card', {
        last_four: cardData.pan.slice(-4),
        exp_month: cardData.exp_month,
        exp_year: cardData.exp_year
      });

      // Prepare tokenization request
      const requestPayload = {
        primaryAccountNumber: cardData.pan,
        requestId: crypto.randomUUID(),
        tokenType: 'SECURE_PAYMENT_TOKEN'
      };

      // Make tokenization request
      const response = await this.makeVisaAPIRequest(
        '/vts/v1/enrollment',
        'POST',
        requestPayload
      );

      if (response.status === 'SUCCESS' && response.vPanEnrollmentID) {
        const token: VisaCardToken = {
          token: response.vPanEnrollmentID,
          last_four: cardData.pan.slice(-4),
          brand: 'VISA',
          exp_month: cardData.exp_month,
          exp_year: cardData.exp_year,
          created_at: new Date(),
          expires_at: new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)) // 1 year
        };

        secureLogger.info('Card tokenized successfully', {
          token_id: token.token.slice(0, 8) + '...',
          last_four: token.last_four
        });

        return token;
      }

      throw new Error('Tokenization failed: ' + response.message);

    } catch (error) {
      secureLogger.error('Card tokenization failed', {
        last_four: cardData.pan.slice(-4),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw error;
    }
  }

  /**
   * Get transaction status
   */
  public async getTransactionStatus(transactionId: string): Promise<any> {
    try {
      const response = await this.makeVisaAPIRequest(
        `/visadirect/fundstransfer/v1/pullfundstransactions/${transactionId}`,
        'GET'
      );

      return {
        transaction_id: transactionId,
        status: response.status,
        amount: parseFloat(response.amount),
        currency: this.getCurrencyFromCode(response.transactionCurrencyCode),
        created_at: response.localTransactionDateTime,
        approval_code: response.approvalCode,
        response_code: response.responseCode
      };

    } catch (error) {
      secureLogger.error('Failed to get transaction status', {
        transactionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Process refund
   */
  public async processRefund(refundData: {
    original_transaction_id: string;
    amount: number;
    currency: string;
    reason?: string;
  }): Promise<VisaPaymentResult> {
    try {
      const refundId = `refund_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;
      
      secureLogger.info('Processing Visa refund', {
        originalTransactionId: refundData.original_transaction_id,
        refundId,
        amount: refundData.amount,
        currency: refundData.currency
      });

      // Prepare refund request
      const requestPayload = {
        acquirerCountryCode: '840',
        acquiringBin: '408999',
        amount: refundData.amount.toFixed(2),
        businessApplicationId: 'AA',
        cardAcceptor: {
          address: {
            country: 'USA',
            county: 'San Mateo',
            state: 'CA',
            zipCode: '94404'
          },
          idCode: 'UPP_MERCHANT',
          name: 'Universal Payment Protocol',
          terminalId: 'UPP001'
        },
        localTransactionDateTime: new Date().toISOString().replace(/[-:]/g, '').slice(0, 14),
        merchantCategoryCode: '5999',
        originalDataElements: {
          acquiringBin: '408999',
          approvalCode: '123456',
          systemsTraceAuditNumber: this.generateSTAN(),
          transmissionDateTime: new Date().toISOString().replace(/[-:]/g, '').slice(0, 10)
        },
        pointOfServiceData: {
          panEntryMode: '81',
          posConditionCode: '59'
        },
        retrievalReferenceNumber: this.generateRRN(),
        systemsTraceAuditNumber: this.generateSTAN(),
        transactionCurrencyCode: this.getCurrencyCode(refundData.currency),
        transactionIdentifier: refundId
      };

      // Make refund request
      const response = await this.makeVisaAPIRequest(
        '/visanetconnect/v1/refund',
        'POST',
        requestPayload
      );

      const result = this.processVisaResponse(response, {
        transaction_id: refundId,
        amount: refundData.amount,
        currency: refundData.currency
      }, 0);

      secureLogger.info('Visa refund processed', {
        refundId,
        success: result.success,
        responseCode: result.response_code
      });

      return result;

    } catch (error) {
      secureLogger.error('Visa refund failed', {
        originalTransactionId: refundData.original_transaction_id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  // Private helper methods
  private async makeVisaAPIRequest(
    endpoint: string, 
    method: 'GET' | 'POST' | 'PUT' | 'DELETE', 
    payload?: any
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const auth = Buffer.from(`${this.userId}:${this.password}`).toString('base64');
      const body = payload ? JSON.stringify(payload) : undefined;
      
      const options = {
        hostname: this.apiBaseUrl.replace('https://', ''),
        port: 443,
        path: endpoint,
        method,
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Request-Id': crypto.randomUUID(),
          ...(body && { 'Content-Length': Buffer.byteLength(body) })
        },
        // For sandbox/testing, we might need to disable cert validation
        rejectUnauthorized: this.isProduction
      };

      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(response);
            } else {
              reject(new Error(`API Error: ${res.statusCode} - ${response.message || data}`));
            }
          } catch (error) {
            reject(new Error(`Invalid JSON response: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (body) {
        req.write(body);
      }
      
      req.end();
    });
  }

  private processVisaResponse(response: any, originalPayment: any, processingTime: number): VisaPaymentResult {
    const isSuccess = response.responseCode === '00' || response.responseCode === '000';
    
    return {
      success: isSuccess,
      transaction_id: originalPayment.transaction_id,
      visa_transaction_id: response.transactionIdentifier,
      amount: originalPayment.amount,
      currency: originalPayment.currency,
      status: isSuccess ? 'approved' : 'declined',
      approval_code: response.approvalCode,
      response_code: response.responseCode,
      response_message: response.message || this.getResponseMessage(response.responseCode),
      processing_fee: this.calculateProcessingFee(originalPayment.amount),
      interchange_fee: this.calculateInterchangeFee(originalPayment.amount),
      settlement_date: response.settlementDate,
      raw_response: response
    };
  }

  private generateRRN(): string {
    return Math.random().toString().substring(2, 14);
  }

  private generateSTAN(): string {
    return Math.floor(Math.random() * 999999).toString().padStart(6, '0');
  }

  private getCurrencyCode(currency: string): string {
    const currencyCodes: Record<string, string> = {
      'USD': '840',
      'EUR': '978',
      'GBP': '826',
      'JPY': '392',
      'CAD': '124',
      'AUD': '036'
    };
    return currencyCodes[currency] || '840';
  }

  private getCurrencyFromCode(code: string): string {
    const codeToCurrency: Record<string, string> = {
      '840': 'USD',
      '978': 'EUR',
      '826': 'GBP',
      '392': 'JPY',
      '124': 'CAD',
      '036': 'AUD'
    };
    return codeToCurrency[code] || 'USD';
  }

  private getResponseMessage(code: string): string {
    const responseCodes: Record<string, string> = {
      '00': 'Approved',
      '000': 'Approved',
      '05': 'Do not honor',
      '14': 'Invalid card number',
      '51': 'Insufficient funds',
      '54': 'Expired card',
      '61': 'Exceeds withdrawal amount limit',
      '62': 'Restricted card',
      '65': 'Exceeds withdrawal frequency limit',
      '91': 'Issuer unavailable',
      '96': 'System malfunction'
    };
    return responseCodes[code] || 'Transaction declined';
  }

  private calculateProcessingFee(amount: number): number {
    // Visa Direct typically charges around $0.25 per transaction
    return 0.25;
  }

  private calculateInterchangeFee(amount: number): number {
    // Typical interchange fee is around 1.4% + $0.05
    return (amount * 0.014) + 0.05;
  }
}

// Export singleton instance
export const visaDirectProcessor = VisaDirectProcessor.getInstance();
