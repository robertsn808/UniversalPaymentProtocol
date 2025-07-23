import secureLogger from '../shared/logger.js';
import { db } from '../database/connection';
import { ValidationError, PaymentError } from '../utils/errors';

export interface BusinessPaymentRequest {
  amount: number;
  currency: string;
  deviceId: string;
  deviceType: string;
  customerEmail?: string;
  description: string;
  merchantId?: string;
  businessType: 'retail' | 'restaurant' | 'service' | 'subscription' | 'gaming' | 'iot';
  paymentMethod: 'card' | 'mobile_wallet' | 'voice' | 'qr' | 'nfc' | 'biometric';
  metadata?: Record<string, any>;
}

export interface PaymentFlowConfig {
  minAmount: number;
  maxAmount: number;
  allowedCurrencies: string[];
  requiresVerification: boolean;
  allowedPaymentMethods: string[];
  autoRetryOnFailure: boolean;
  fraudCheckLevel: 'low' | 'medium' | 'high';
}

export class PaymentFlowManager {
  private businessConfigs: Map<string, PaymentFlowConfig> = new Map();

  constructor() {
    this.initializeBusinessConfigs();
  }

  private initializeBusinessConfigs(): void {
    // Retail business configuration
    this.businessConfigs.set('retail', {
      minAmount: 0.50,
      maxAmount: 10000,
      allowedCurrencies: ['USD', 'EUR', 'GBP', 'CAD'],
      requiresVerification: false,
      allowedPaymentMethods: ['card', 'mobile_wallet', 'nfc', 'qr'],
      autoRetryOnFailure: true,
      fraudCheckLevel: 'medium'
    });

    // Restaurant business configuration
    this.businessConfigs.set('restaurant', {
      minAmount: 1.00,
      maxAmount: 1000,
      allowedCurrencies: ['USD', 'EUR', 'GBP'],
      requiresVerification: false,
      allowedPaymentMethods: ['card', 'mobile_wallet', 'nfc', 'qr'],
      autoRetryOnFailure: true,
      fraudCheckLevel: 'low'
    });

    // Service business configuration
    this.businessConfigs.set('service', {
      minAmount: 5.00,
      maxAmount: 50000,
      allowedCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
      requiresVerification: true,
      allowedPaymentMethods: ['card', 'mobile_wallet'],
      autoRetryOnFailure: false,
      fraudCheckLevel: 'high'
    });

    // Subscription business configuration
    this.businessConfigs.set('subscription', {
      minAmount: 0.99,
      maxAmount: 999,
      allowedCurrencies: ['USD', 'EUR', 'GBP'],
      requiresVerification: true,
      allowedPaymentMethods: ['card', 'mobile_wallet'],
      autoRetryOnFailure: true,
      fraudCheckLevel: 'medium'
    });

    // Gaming business configuration
    this.businessConfigs.set('gaming', {
      minAmount: 0.99,
      maxAmount: 500,
      allowedCurrencies: ['USD', 'EUR', 'GBP', 'JPY'],
      requiresVerification: false,
      allowedPaymentMethods: ['card', 'mobile_wallet'],
      autoRetryOnFailure: true,
      fraudCheckLevel: 'medium'
    });

    // IoT business configuration
    this.businessConfigs.set('iot', {
      minAmount: 0.01,
      maxAmount: 1000,
      allowedCurrencies: ['USD', 'EUR'],
      requiresVerification: false,
      allowedPaymentMethods: ['card', 'mobile_wallet'],
      autoRetryOnFailure: true,
      fraudCheckLevel: 'low'
    });
  }

  async validateBusinessPayment(request: BusinessPaymentRequest): Promise<void> {
    const config = this.businessConfigs.get(request.businessType);
    
    if (!config) {
      throw new ValidationError(`Unsupported business type: ${request.businessType}`);
    }

    // Amount validation
    if (request.amount < config.minAmount) {
      throw new ValidationError(
        `Payment amount ${request.amount} is below minimum ${config.minAmount} for ${request.businessType} business`
      );
    }

    if (request.amount > config.maxAmount) {
      throw new ValidationError(
        `Payment amount ${request.amount} exceeds maximum ${config.maxAmount} for ${request.businessType} business`
      );
    }

    // Currency validation
    if (!config.allowedCurrencies.includes(request.currency)) {
      throw new ValidationError(
        `Currency ${request.currency} not supported for ${request.businessType} business. Allowed: ${config.allowedCurrencies.join(', ')}`
      );
    }

    // Payment method validation
    if (!config.allowedPaymentMethods.includes(request.paymentMethod)) {
      throw new ValidationError(
        `Payment method ${request.paymentMethod} not supported for ${request.businessType} business. Allowed: ${config.allowedPaymentMethods.join(', ')}`
      );
    }

    // Device-specific validation
    await this.validateDeviceCompatibility(request.deviceType, request.paymentMethod);

    // Business-specific validations
    await this.validateBusinessSpecificRules(request, config);

    secureLogger.info('Business payment validation passed', {
      businessType: request.businessType,
      amount: request.amount,
      currency: request.currency,
      paymentMethod: request.paymentMethod,
      deviceType: request.deviceType
    });
  }

  private async validateDeviceCompatibility(deviceType: string, paymentMethod: string): Promise<void> {
    const deviceCapabilities: Record<string, string[]> = {
      'smartphone': ['card', 'mobile_wallet', 'nfc', 'qr', 'biometric'],
      'smart_tv': ['qr', 'card'],
      'iot_device': ['card', 'mobile_wallet'],
      'voice_assistant': ['voice', 'card'],
      'gaming_console': ['card', 'mobile_wallet'],
      'tablet': ['card', 'mobile_wallet', 'nfc', 'qr', 'biometric'],
      'pos_terminal': ['card', 'nfc'],
      'kiosk': ['card', 'qr', 'nfc']
    };

    const supportedMethods = deviceCapabilities[deviceType];
    
    if (!supportedMethods || !supportedMethods.includes(paymentMethod)) {
      throw new ValidationError(
        `Payment method ${paymentMethod} not supported on ${deviceType}. Supported methods: ${supportedMethods?.join(', ') || 'none'}`
      );
    }
  }

  private async validateBusinessSpecificRules(
    request: BusinessPaymentRequest, 
    config: PaymentFlowConfig
  ): Promise<void> {
    switch (request.businessType) {
      case 'retail':
        await this.validateRetailPayment(request);
        break;
      
      case 'restaurant':
        await this.validateRestaurantPayment(request);
        break;
      
      case 'service':
        await this.validateServicePayment(request);
        break;
      
      case 'subscription':
        await this.validateSubscriptionPayment(request);
        break;
      
      case 'gaming':
        await this.validateGamingPayment(request);
        break;
      
      case 'iot':
        await this.validateIoTPayment(request);
        break;
    }
  }

  private async validateRetailPayment(request: BusinessPaymentRequest): Promise<void> {
    // Retail-specific validation
    if (request.amount > 5000 && !request.customerEmail) {
      throw new ValidationError('Large retail transactions require customer email');
    }

    // Check for suspicious transaction patterns
    const recentTransactions = await this.getRecentTransactions(request.deviceId, 1); // Last hour
    if (recentTransactions.length > 10) {
      throw new ValidationError('Too many transactions from this device in the last hour');
    }
  }

  private async validateRestaurantPayment(request: BusinessPaymentRequest): Promise<void> {
    // Restaurant-specific validation
    const validHours = this.isValidBusinessHours('restaurant');
    if (!validHours && request.amount > 200) {
      secureLogger.warn('Large restaurant payment outside business hours', {
        amount: request.amount,
        time: new Date()
      });
    }

    // Tip validation
    if (request.metadata?.tip && request.metadata.tip > request.amount * 0.5) {
      throw new ValidationError('Tip amount seems excessive (over 50% of bill)');
    }
  }

  private async validateServicePayment(request: BusinessPaymentRequest): Promise<void> {
    // Service payments require verification for amounts over $500
    if (request.amount > 500 && !request.customerEmail) {
      throw new ValidationError('Service payments over $500 require customer email');
    }

    // Check if this is a repeat customer
    if (request.customerEmail) {
      const customerHistory = await this.getCustomerHistory(request.customerEmail);
      if (customerHistory.totalPayments === 0 && request.amount > 1000) {
        throw new ValidationError('New customers are limited to $1000 for first payment');
      }
    }
  }

  private async validateSubscriptionPayment(request: BusinessPaymentRequest): Promise<void> {
    // Subscription-specific validation
    if (!request.customerEmail) {
      throw new ValidationError('Subscription payments require customer email');
    }

    // Check for existing subscriptions
    const existingSubscription = await this.checkExistingSubscription(
      request.customerEmail, 
      request.merchantId || 'default'
    );
    
    if (existingSubscription && request.metadata?.type === 'initial') {
      throw new ValidationError('Customer already has an active subscription');
    }
  }

  private async validateGamingPayment(request: BusinessPaymentRequest): Promise<void> {
    // Gaming-specific validation
    const dailyLimit = await this.getDailySpendingLimit(request.deviceId);
    const todaySpent = await this.getTodaySpending(request.deviceId);
    
    if (todaySpent + request.amount > dailyLimit) {
      throw new ValidationError(`Daily spending limit of $${dailyLimit} would be exceeded`);
    }

    // Age verification for certain gaming purchases
    if (request.metadata?.ageRestricted && !request.metadata?.ageVerified) {
      throw new ValidationError('Age verification required for this gaming purchase');
    }
  }

  private async validateIoTPayment(request: BusinessPaymentRequest): Promise<void> {
    // IoT-specific validation
    if (!request.metadata?.automatedPurchase) {
      throw new ValidationError('IoT payments must be marked as automated');
    }

    // Check device authorization
    const deviceAuth = await this.checkDeviceAuthorization(request.deviceId);
    if (!deviceAuth) {
      throw new ValidationError('Device not authorized for automated payments');
    }

    // Monthly spending limits for IoT devices
    const monthlySpent = await this.getMonthlySpending(request.deviceId);
    const monthlyLimit = request.metadata?.monthlyLimit || 500;
    
    if (monthlySpent + request.amount > monthlyLimit) {
      throw new ValidationError(`Monthly IoT spending limit of $${monthlyLimit} would be exceeded`);
    }
  }

  // Helper methods
  private isValidBusinessHours(businessType: string): boolean {
    const now = new Date();
    const hour = now.getHours();
    
    switch (businessType) {
      case 'restaurant':
        return hour >= 6 && hour <= 23; // 6 AM to 11 PM
      case 'retail':
        return hour >= 8 && hour <= 22; // 8 AM to 10 PM
      default:
        return true; // 24/7 for other businesses
    }
  }

  private async getRecentTransactions(deviceId: string, hours: number): Promise<any[]> {
    const result = await db.query(`
      SELECT COUNT(*) as count 
      FROM transactions 
      WHERE device_id = $1 
        AND created_at >= NOW() - INTERVAL '${hours} hours'
    `, [deviceId]);
    
    return Array(parseInt(result.rows[0].count)).fill(null);
  }

  private async getCustomerHistory(email: string): Promise<{ totalPayments: number; totalAmount: number }> {
    const result = await db.query(`
      SELECT 
        COUNT(*) as total_payments,
        COALESCE(SUM(amount), 0) as total_amount
      FROM transactions 
      WHERE customer_email = $1 AND status = 'completed'
    `, [email]);
    
    return {
      totalPayments: parseInt(result.rows[0].total_payments),
      totalAmount: parseFloat(result.rows[0].total_amount)
    };
  }

  private async checkExistingSubscription(email: string, merchantId: string): Promise<boolean> {
    const result = await db.query(`
      SELECT COUNT(*) as count 
      FROM transactions 
      WHERE customer_email = $1 
        AND merchant_id = $2 
        AND status = 'completed'
        AND metadata->>'subscription_status' = 'active'
    `, [email, merchantId]);
    
    return parseInt(result.rows[0].count) > 0;
  }

  private async getDailySpendingLimit(deviceId: string): Promise<number> {
    // Default daily limit, could be configured per device
    const result = await db.query(`
      SELECT 
        COALESCE(metadata->>'daily_limit', '200')::numeric as daily_limit
      FROM devices 
      WHERE id = $1
    `, [deviceId]);
    
    return result.rows.length > 0 ? parseFloat(result.rows[0].daily_limit) : 200;
  }

  private async getTodaySpending(deviceId: string): Promise<number> {
    const result = await db.query(`
      SELECT COALESCE(SUM(amount), 0) as today_spent
      FROM transactions 
      WHERE device_id = $1 
        AND DATE(created_at) = CURRENT_DATE
        AND status = 'completed'
    `, [deviceId]);
    
    return parseFloat(result.rows[0].today_spent);
  }

  private async getMonthlySpending(deviceId: string): Promise<number> {
    const result = await db.query(`
      SELECT COALESCE(SUM(amount), 0) as monthly_spent
      FROM transactions 
      WHERE device_id = $1 
        AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)
        AND status = 'completed'
    `, [deviceId]);
    
    return parseFloat(result.rows[0].monthly_spent);
  }

  private async checkDeviceAuthorization(deviceId: string): Promise<boolean> {
    const result = await db.query(`
      SELECT 
        COALESCE(metadata->>'automated_payments_enabled', 'false')::boolean as authorized
      FROM devices 
      WHERE id = $1
    `, [deviceId]);
    
    return result.rows.length > 0 ? result.rows[0].authorized : false;
  }

  // Get business configuration for a specific business type
  getBusinessConfig(businessType: string): PaymentFlowConfig | undefined {
    return this.businessConfigs.get(businessType);
  }

  // Update business configuration
  updateBusinessConfig(businessType: string, config: Partial<PaymentFlowConfig>): void {
    const existingConfig = this.businessConfigs.get(businessType);
    if (existingConfig) {
      this.businessConfigs.set(businessType, { ...existingConfig, ...config });
      secureLogger.info('Business configuration updated', { businessType, config });
    }
  }
}

export const paymentFlowManager = new PaymentFlowManager();