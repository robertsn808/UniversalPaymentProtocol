import { z } from 'zod';

import { auditTrail } from '../compliance/audit-trail.js';
import { db } from '../database/connection.js';
import { env } from '../config/environment.js';
import secureLogger from '../shared/logger.js';

/**
 * Multi-Currency Payment System
 * Supports global payments with real-time exchange rates
 */

// Currency definitions
export const SupportedCurrencies = [
  // Major currencies
  'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'SEK', 'NZD',
  // Regional currencies
  'BRL', 'MXN', 'INR', 'KRW', 'SGD', 'HKD', 'NOK', 'PLN', 'TRY', 'ZAR',
  // Cryptocurrencies
  'BTC', 'ETH', 'USDC', 'USDT', 'ADA', 'DOT', 'MATIC',
] as const;

export type Currency = (typeof SupportedCurrencies)[number];

// Schemas
export const CurrencySchema = z.enum(SupportedCurrencies);

export const ExchangeRateSchema = z.object({
  from_currency: CurrencySchema,
  to_currency: CurrencySchema,
  rate: z.number().positive(),
  provider: z.string(),
  timestamp: z.date(),
  expires_at: z.date(),
});

export const MultiCurrencyWalletSchema = z.object({
  user_id: z.string().uuid(),
  balances: z.record(CurrencySchema, z.number().nonnegative()),
  preferred_currency: CurrencySchema,
  created_at: z.date(),
  updated_at: z.date(),
});

export const CurrencyConversionSchema = z.object({
  from_currency: CurrencySchema,
  to_currency: CurrencySchema,
  from_amount: z.number().positive(),
  to_amount: z.number().positive(),
  exchange_rate: z.number().positive(),
  fees: z.number().nonnegative(),
  provider: z.string(),
  conversion_id: z.string().uuid(),
});

export type ExchangeRate = z.infer<typeof ExchangeRateSchema>;
export type MultiCurrencyWallet = z.infer<typeof MultiCurrencyWalletSchema>;
export type CurrencyConversion = z.infer<typeof CurrencyConversionSchema>;

// Regional payment methods mapping
export const RegionalPaymentMethods = {
  // Asia-Pacific
  CNY: ['alipay', 'wechat_pay', 'union_pay'],
  INR: ['upi', 'paytm', 'razorpay', 'phonepe'],
  JPY: ['konbini', 'pay_pay', 'rakuten_pay'],
  KRW: ['kakao_pay', 'naver_pay', 'toss'],
  SGD: ['grab_pay', 'nets', 'paynow'],
  
  // Europe
  EUR: ['sepa', 'ideal', 'bancontact', 'sofort', 'eps'],
  GBP: ['bacs', 'faster_payments', 'open_banking'],
  SEK: ['swish', 'klarna'],
  PLN: ['blik', 'przelewy24'],
  
  // Americas
  USD: ['ach', 'wire', 'venmo', 'cash_app'],
  BRL: ['pix', 'boleto', 'mercado_pago'],
  MXN: ['spei', 'oxxo', 'mercado_pago'],
  CAD: ['interac', 'e_transfer'],
  
  // Africa & Middle East
  ZAR: ['eft', 'capitec_pay'],
  EGP: ['fawry', 'vodafone_cash'],
  KES: ['m_pesa', 'airtel_money'],
} as const;

export class MultiCurrencyPaymentSystem {
  private static instance: MultiCurrencyPaymentSystem;
  private exchangeRateCache: Map<string, ExchangeRate> = new Map();
  private readonly cacheExpiry = 60000; // 1 minute

  private constructor() {
    this.initializeExchangeRateUpdates();
  }

  public static getInstance(): MultiCurrencyPaymentSystem {
    if (!MultiCurrencyPaymentSystem.instance) {
      MultiCurrencyPaymentSystem.instance = new MultiCurrencyPaymentSystem();
    }
    return MultiCurrencyPaymentSystem.instance;
  }

  /**
   * Get real-time exchange rate
   */
  public async getExchangeRate(
    fromCurrency: Currency,
    toCurrency: Currency,
    provider: 'fixer' | 'openexchangerates' | 'coinbase' = 'fixer'
  ): Promise<ExchangeRate> {
    const cacheKey = `${fromCurrency}-${toCurrency}-${provider}`;
    const cached = this.exchangeRateCache.get(cacheKey);
    
    if (cached && cached.expires_at > new Date()) {
      return cached;
    }

    // Fetch fresh rate
    const rate = await this.fetchExchangeRate(fromCurrency, toCurrency, provider);
    
    // Cache for performance
    this.exchangeRateCache.set(cacheKey, rate);
    
    // Store in database for audit
    await this.storeExchangeRate(rate);
    
    return rate;
  }

  /**
   * Convert currency amounts
   */
  public async convertCurrency(
    fromCurrency: Currency,
    toCurrency: Currency,
    amount: number,
    userId?: string
  ): Promise<CurrencyConversion> {
    if (fromCurrency === toCurrency) {
      return {
        from_currency: fromCurrency,
        to_currency: toCurrency,
        from_amount: amount,
        to_amount: amount,
        exchange_rate: 1,
        fees: 0,
        provider: 'internal',
        conversion_id: crypto.randomUUID(),
      };
    }

    const exchangeRate = await this.getExchangeRate(fromCurrency, toCurrency);
    const fees = this.calculateConversionFees(amount, fromCurrency, toCurrency);
    const convertedAmount = (amount * exchangeRate.rate) - fees;

    const conversion: CurrencyConversion = {
      from_currency: fromCurrency,
      to_currency: toCurrency,
      from_amount: amount,
      to_amount: convertedAmount,
      exchange_rate: exchangeRate.rate,
      fees,
      provider: exchangeRate.provider,
      conversion_id: crypto.randomUUID(),
    };

    // Log conversion for audit
    if (userId) {
      await auditTrail.logPaymentEvent({
        user_id: userId,
        action: 'payment_attempt',
        transaction_id: conversion.conversion_id,
        amount,
        currency: fromCurrency,
        ip_address: '127.0.0.1',
        correlation_id: crypto.randomUUID(),
      });
    }

    secureLogger.info('Currency conversion completed', {
      conversionId: conversion.conversion_id,
      fromCurrency,
      toCurrency,
      amount,
      convertedAmount,
      rate: exchangeRate.rate,
      fees,
    });

    return conversion;
  }

  /**
   * Create multi-currency wallet
   */
  public async createWallet(
    userId: string,
    preferredCurrency: Currency = 'USD'
  ): Promise<MultiCurrencyWallet> {
    const wallet: MultiCurrencyWallet = {
      user_id: userId,
      balances: {},
      preferred_currency: preferredCurrency,
      created_at: new Date(),
      updated_at: new Date(),
    };

    // Initialize with zero balances for major currencies
    const majorCurrencies: Currency[] = ['USD', 'EUR', 'GBP', 'JPY', 'CAD'];
    for (const currency of majorCurrencies) {
      wallet.balances[currency] = 0;
    }

    await this.storeWallet(wallet);

    secureLogger.info('Multi-currency wallet created', {
      userId,
      preferredCurrency,
      supportedCurrencies: majorCurrencies,
    });

    return wallet;
  }

  /**
   * Get wallet balance in specific currency
   */
  public async getBalance(userId: string, currency: Currency): Promise<number> {
    const wallet = await this.getWallet(userId);
    return wallet.balances[currency] || 0;
  }

  /**
   * Get wallet balance converted to preferred currency
   */
  public async getTotalBalanceInPreferredCurrency(userId: string): Promise<{
    total_balance: number;
    currency: Currency;
    breakdown: Record<Currency, { amount: number; converted_amount: number; rate: number }>;
  }> {
    const wallet = await this.getWallet(userId);
    const breakdown: Record<string, any> = {};
    let totalBalance = 0;

    for (const [currency, amount] of Object.entries(wallet.balances)) {
      if (amount > 0) {
        const conversion = await this.convertCurrency(
          currency as Currency,
          wallet.preferred_currency,
          amount,
          userId
        );
        
        breakdown[currency] = {
          amount,
          converted_amount: conversion.to_amount,
          rate: conversion.exchange_rate,
        };
        
        totalBalance += conversion.to_amount;
      }
    }

    return {
      total_balance: totalBalance,
      currency: wallet.preferred_currency,
      breakdown,
    };
  }

  /**
   * Process multi-currency payment
   */
  public async processMultiCurrencyPayment(paymentData: {
    user_id: string;
    amount: number;
    currency: Currency;
    merchant_preferred_currency?: Currency;
    payment_method: string;
    device_type: string;
    correlation_id: string;
  }): Promise<{
    success: boolean;
    transaction_id: string;
    original_amount: number;
    original_currency: Currency;
    processed_amount?: number;
    processed_currency?: Currency;
    exchange_rate?: number;
    fees?: number;
    settlement_currency: Currency;
    regional_payment_method?: string;
  }> {
    const transactionId = `txn_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;
    
    try {
      // Determine settlement currency
      const settlementCurrency = paymentData.merchant_preferred_currency || paymentData.currency;
      
      let processedAmount = paymentData.amount;
      let exchangeRate: number | undefined;
      let fees: number | undefined;

      // Convert currency if needed
      if (paymentData.currency !== settlementCurrency) {
        const conversion = await this.convertCurrency(
          paymentData.currency,
          settlementCurrency,
          paymentData.amount,
          paymentData.user_id
        );
        
        processedAmount = conversion.to_amount;
        exchangeRate = conversion.exchange_rate;
        fees = conversion.fees;
      }

      // Select regional payment method
      const regionalPaymentMethod = this.selectRegionalPaymentMethod(
        settlementCurrency,
        paymentData.payment_method,
        paymentData.device_type
      );

      // Process payment through appropriate gateway
      const paymentResult = await this.processPaymentThroughGateway(
        processedAmount,
        settlementCurrency,
        regionalPaymentMethod,
        paymentData
      );

      // Update wallet balance if successful
      if (paymentResult.success) {
        await this.updateWalletBalance(
          paymentData.user_id,
          paymentData.currency,
          -paymentData.amount
        );
      }

      // Log payment
      await auditTrail.logPaymentEvent({
        user_id: paymentData.user_id,
        action: paymentResult.success ? 'payment_success' : 'payment_failure',
        transaction_id: transactionId,
        amount: paymentData.amount,
        currency: paymentData.currency,
        ip_address: '127.0.0.1',
        correlation_id: paymentData.correlation_id,
      });

      return {
        success: paymentResult.success,
        transaction_id: transactionId,
        original_amount: paymentData.amount,
        original_currency: paymentData.currency,
        processed_amount: processedAmount,
        processed_currency: settlementCurrency,
        exchange_rate: exchangeRate,
        fees: fees,
        settlement_currency: settlementCurrency,
        regional_payment_method: regionalPaymentMethod,
      };

    } catch (error) {
      secureLogger.error('Multi-currency payment failed', {
        transactionId,
        userId: paymentData.user_id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        transaction_id: transactionId,
        original_amount: paymentData.amount,
        original_currency: paymentData.currency,
        settlement_currency: paymentData.currency, // Use original currency as fallback
      };
    }
  }

  /**
   * Get supported payment methods for currency/region
   */
  public getSupportedPaymentMethods(currency: Currency, country?: string): string[] {
    const methods = (RegionalPaymentMethods as any)[currency] || [];
    
    // Add global methods
    const globalMethods = ['card', 'bank_transfer', 'digital_wallet'];
    
    return [...methods, ...globalMethods];
  }

  /**
   * Get currency info and formatting
   */
  public getCurrencyInfo(currency: Currency): {
    code: Currency;
    name: string;
    symbol: string;
    decimal_places: number;
    is_crypto: boolean;
  } {
    const currencyInfo: Partial<Record<Currency, any>> = {
      USD: { name: 'US Dollar', symbol: '$', decimal_places: 2, is_crypto: false },
      EUR: { name: 'Euro', symbol: '€', decimal_places: 2, is_crypto: false },
      GBP: { name: 'British Pound', symbol: '£', decimal_places: 2, is_crypto: false },
      JPY: { name: 'Japanese Yen', symbol: '¥', decimal_places: 0, is_crypto: false },
      CNY: { name: 'Chinese Yuan', symbol: '¥', decimal_places: 2, is_crypto: false },
      INR: { name: 'Indian Rupee', symbol: '₹', decimal_places: 2, is_crypto: false },
      BTC: { name: 'Bitcoin', symbol: '₿', decimal_places: 8, is_crypto: true },
      ETH: { name: 'Ethereum', symbol: 'Ξ', decimal_places: 18, is_crypto: true },
      USDC: { name: 'USD Coin', symbol: 'USDC', decimal_places: 6, is_crypto: true },
      // ... (other currencies would be defined here)
    };

    return {
      code: currency,
      ...currencyInfo[currency],
    };
  }

  // Private methods
  private async fetchExchangeRate(
    from: Currency,
    to: Currency,
    provider: string
  ): Promise<ExchangeRate> {
    // Mock implementation - in production, integrate with real providers
    const mockRates: Record<string, number> = {
      'USD-EUR': 0.85,
      'USD-GBP': 0.73,
      'USD-JPY': 110.0,
      'EUR-USD': 1.18,
      'GBP-USD': 1.37,
      'BTC-USD': 45000.0,
      'ETH-USD': 3000.0,
    };

    const rateKey = `${from}-${to}`;
    const inverseKey = `${to}-${from}`;
    
    let rate = mockRates[rateKey];
    if (!rate && mockRates[inverseKey]) {
      rate = 1 / mockRates[inverseKey];
    }
    
    if (!rate) {
      rate = 1.0; // Fallback
    }

    return {
      from_currency: from,
      to_currency: to,
      rate,
      provider,
      timestamp: new Date(),
      expires_at: new Date(Date.now() + this.cacheExpiry),
    };
  }

  private calculateConversionFees(
    amount: number,
    fromCurrency: Currency,
    toCurrency: Currency
  ): number {
    // Fee structure
    const baseFeeRate = 0.005; // 0.5% base fee
    const cryptoFeeRate = 0.015; // 1.5% for crypto
    const crossBorderFeeRate = 0.003; // 0.3% additional for cross-border
    
    const fromInfo = this.getCurrencyInfo(fromCurrency);
    const toInfo = this.getCurrencyInfo(toCurrency);
    
    let feeRate = baseFeeRate;
    
    // Higher fees for crypto
    if (fromInfo.is_crypto || toInfo.is_crypto) {
      feeRate = cryptoFeeRate;
    }
    
    // Additional cross-border fees
    if (this.isCrossBorderTransaction(fromCurrency, toCurrency)) {
      feeRate += crossBorderFeeRate;
    }
    
    return amount * feeRate;
  }

  private isCrossBorderTransaction(from: Currency, to: Currency): boolean {
    // Simplified logic - in production, this would be more sophisticated
    const regions: Record<string, Currency[]> = {
      north_america: ['USD', 'CAD', 'MXN'],
      europe: ['EUR', 'GBP', 'CHF', 'SEK', 'NOK', 'PLN'],
      asia: ['JPY', 'CNY', 'INR', 'KRW', 'SGD'],
      crypto: ['BTC', 'ETH', 'USDC', 'USDT'],
    };
    
    for (const regionCurrencies of Object.values(regions)) {
      if (regionCurrencies.includes(from) && regionCurrencies.includes(to)) {
        return false;
      }
    }
    
    return true;
  }

  private selectRegionalPaymentMethod(
    currency: Currency,
    preferredMethod: string,
    deviceType: string
  ): string {
    const supportedMethods = (RegionalPaymentMethods as any)[currency] || [];
    
    // If preferred method is supported, use it
    if (supportedMethods.includes(preferredMethod as any)) {
      return preferredMethod;
    }
    
    // Select best method for device type
    if (deviceType === 'mobile' && currency === 'CNY') {
      return 'alipay'; // Popular mobile payment in China
    }
    
    if (deviceType === 'mobile' && currency === 'INR') {
      return 'upi'; // Popular mobile payment in India
    }
    
    // Default to first supported method or card
    return supportedMethods[0] || 'card';
  }

  private async processPaymentThroughGateway(
    amount: number,
    currency: Currency,
    paymentMethod: string,
    paymentData: any
  ): Promise<{ success: boolean }> {
    // Mock implementation - integrate with actual payment gateways
    secureLogger.info('Processing payment through gateway', {
      amount,
      currency,
      paymentMethod,
      gateway: this.getGatewayForMethod(paymentMethod),
    });
    
    // Simulate success/failure
    return { success: Math.random() > 0.1 }; // 90% success rate
  }

  private getGatewayForMethod(paymentMethod: string): string {
    const gatewayMapping: Record<string, string> = {
      alipay: 'alipay',
      wechat_pay: 'wechat',
      upi: 'razorpay',
      ideal: 'adyen',
      sepa: 'stripe',
      card: 'stripe',
    };
    
    return gatewayMapping[paymentMethod] || 'stripe';
  }

  private async initializeExchangeRateUpdates(): Promise<void> {
    // Set up periodic exchange rate updates
    setInterval(() => {
      this.updateExchangeRates();
    }, 60000); // Update every minute
  }

  private async updateExchangeRates(): Promise<void> {
    // Update cached exchange rates
    const majorPairs = [
      ['USD', 'EUR'], ['USD', 'GBP'], ['USD', 'JPY'],
      ['EUR', 'GBP'], ['BTC', 'USD'], ['ETH', 'USD']
    ];
    
    for (const [from, to] of majorPairs) {
      try {
        await this.getExchangeRate(from as Currency, to as Currency);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        secureLogger.warn('Failed to update exchange rate', { from, to, error: errorMsg });
      }
    }
  }

  private async storeExchangeRate(rate: ExchangeRate): Promise<void> {
    const query = `
      INSERT INTO exchange_rates (from_currency, to_currency, rate, provider, timestamp, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (from_currency, to_currency, provider) 
      DO UPDATE SET rate = $3, timestamp = $5, expires_at = $6
    `;
    
    await db.query(query, [
      rate.from_currency,
      rate.to_currency,
      rate.rate,
      rate.provider,
      rate.timestamp,
      rate.expires_at,
    ]);
  }

  private async storeWallet(wallet: MultiCurrencyWallet): Promise<void> {
    const query = `
      INSERT INTO multi_currency_wallets (user_id, balances, preferred_currency, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id) DO UPDATE SET 
        balances = $2, preferred_currency = $3, updated_at = $5
    `;
    
    await db.query(query, [
      wallet.user_id,
      JSON.stringify(wallet.balances),
      wallet.preferred_currency,
      wallet.created_at,
      wallet.updated_at,
    ]);
  }

  private async getWallet(userId: string): Promise<MultiCurrencyWallet> {
    const query = 'SELECT * FROM multi_currency_wallets WHERE user_id = $1';
    const result = await db.query(query, [userId]);
    
    if (!result.rows || result.rows.length === 0) {
      return await this.createWallet(userId);
    }
    
    const row = result.rows[0];
    return {
      user_id: row.user_id,
      balances: JSON.parse(row.balances),
      preferred_currency: row.preferred_currency,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private async updateWalletBalance(
    userId: string,
    currency: Currency,
    amount: number
  ): Promise<void> {
    const wallet = await this.getWallet(userId);
    
    const currentBalance = wallet.balances[currency] || 0;
    wallet.balances[currency] = Math.max(0, currentBalance + amount);
    wallet.updated_at = new Date();
    
    await this.storeWallet(wallet);
  }
}

// Singleton instance
export const multiCurrencySystem = MultiCurrencyPaymentSystem.getInstance();