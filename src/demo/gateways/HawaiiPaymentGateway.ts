interface PaymentRequest {
  amount: number;
  merchant_id: string;
  type?: string;
  [key: string]: any;
}

interface PaymentResult {
  success: boolean;
  transaction_id: string;
  amount: number;
  currency: string;
  status: string;
  receipt_data: {
    merchant: string;
    timestamp: string;
    location: string;
  };
  error?: string;
}

export class HawaiiPaymentGateway {
  private successRate: number;
  private delayMs: number;

  constructor(successRate: number = 1.0, delayMs: number = 1000) {
    this.successRate = successRate;
    this.delayMs = delayMs;
  }

  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    try {
      if (!request.amount || request.amount <= 0) {
        throw new Error('Invalid payment amount');
      }

      if (!request.merchant_id) {
        throw new Error('Merchant ID is required');
      }

      await new Promise(resolve => setTimeout(resolve, this.delayMs));
      
      const shouldSucceed = Math.random() < this.successRate;
      
      if (!shouldSucceed) {
        return {
          success: false,
          transaction_id: `txn_failed_${Date.now()}`,
          amount: request.amount,
          currency: 'USD',
          status: 'failed',
          receipt_data: {
            merchant: request.merchant_id,
            timestamp: new Date().toISOString(),
            location: 'Hawaii, USA'
          },
          error: 'Payment processing failed'
        };
      }

      return {
        success: true,
        transaction_id: `txn_hawaii_${Date.now()}`,
        amount: request.amount,
        currency: 'USD',
        status: 'completed',
        receipt_data: {
          merchant: request.merchant_id,
          timestamp: new Date().toISOString(),
          location: 'Hawaii, USA'
        }
      };
    } catch (error) {
      return {
        success: false,
        transaction_id: `txn_error_${Date.now()}`,
        amount: request.amount || 0,
        currency: 'USD',
        status: 'error',
        receipt_data: {
          merchant: request.merchant_id || 'unknown',
          timestamp: new Date().toISOString(),
          location: 'Hawaii, USA'
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}