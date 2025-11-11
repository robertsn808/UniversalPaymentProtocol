// Casino Device Adapter - Universal Payment Protocol for Gaming
// Treats the casino platform as a UPP payment device

import {
  UPPDevice,
  PaymentRequest,
  PaymentResult,
  UserInput,
  DeviceCapabilities,
  SecurityContext
} from '../universal-payment-protocol/core/types.js';
import { UPPError } from '../../utils/errors.js';
import { secureLogger } from '../../shared/logger.js';
import { CasinoDeviceConfig } from './types.js';

export interface CasinoPaymentResponse {
  success: boolean;
  transactionId: string;
  amount: number;
  message?: string;
  displayDuration: number;
  requiresUserAction: boolean;
  redirectUrl?: string;
}

export class CasinoDeviceAdapter implements UPPDevice {
  deviceType = 'casino_terminal';
  fingerprint: string;
  private config: CasinoDeviceConfig;

  constructor(config: CasinoDeviceConfig) {
    this.config = config;
    this.fingerprint = this.generateFingerprint();
    secureLogger.info('🎰 Casino device adapter initialized', {
      casinoId: config.casinoId,
      casinoName: config.casinoName
    });
  }

  getDeviceId(): string {
    return `casino_${this.config.casinoId}_${this.fingerprint}`;
  }

  getDeviceType(): string {
    return this.deviceType;
  }

  getCapabilities(): DeviceCapabilities {
    return {
      hasDisplay: true,
      hasCamera: false,
      hasNFC: false,
      hasBluetooth: false,
      hasWiFi: true,
      hasKeypad: true,
      hasTouchScreen: true,
      hasVoiceInput: false,
      hasVoiceOutput: false,
      hasPrinter: false,
      supportsEncryption: true,
      internet_connection: true,
      maxPaymentAmount: this.config.maxDepositAmount,
      supportedCurrencies: this.config.supportedCurrencies,
      securityLevel: 'HIGH'
    };
  }

  getDeviceFingerprint(): string {
    return this.fingerprint;
  }

  getFingerprint(): string {
    return this.fingerprint;
  }

  getSecurityContext(): SecurityContext {
    return {
      encryptionLevel: 'AES256',
      deviceAttestation: 'trusted',
      userAuthentication: 'session_based',
      trustedEnvironment: true,
      complianceLevel: this.config.kycRequired ? 'KYC_VERIFIED' : 'BASIC',
      geoRestrictions: this.config.geoRestrictions
    };
  }

  private generateFingerprint(): string {
    // Generate unique fingerprint for casino device
    const data = `${this.config.casinoId}_${this.config.operatorId}_${Date.now()}`;
    return Buffer.from(data).toString('base64').substring(0, 32);
  }

  // Casino-specific: Capture player input for transactions
  async captureUserInput(): Promise<UserInput> {
    // This would be called by the casino frontend
    // The actual input comes from the Laravel application
    return {
      type: 'web_form',
      data: {
        casinoId: this.config.casinoId,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date()
    };
  }

  // Handle payment response and notify casino
  async handlePaymentResponse(response: PaymentResult): Promise<CasinoPaymentResponse> {
    secureLogger.info('🎰 Casino received payment response', {
      success: response.success,
      amount: response.amount,
      transactionId: response.transactionId
    });

    if (response.success) {
      // Log successful transaction
      await this.logCasinoTransaction(response);

      // Notify casino system
      await this.notifyCasinoSystem({
        type: 'PAYMENT_SUCCESS',
        transactionId: response.transactionId,
        amount: response.amount,
        playerId: response.metadata?.playerId
      });

      return {
        success: true,
        transactionId: response.transactionId,
        amount: response.amount,
        message: `Deposit of $${response.amount} successful`,
        displayDuration: 5000,
        requiresUserAction: false
      };
    } else {
      // Handle payment failure
      await this.logCasinoTransaction(response);

      await this.notifyCasinoSystem({
        type: 'PAYMENT_FAILED',
        transactionId: response.transactionId,
        error: response.error,
        playerId: response.metadata?.playerId
      });

      return {
        success: false,
        transactionId: response.transactionId,
        amount: response.amount,
        message: response.error || 'Payment failed',
        displayDuration: 10000,
        requiresUserAction: true
      };
    }
  }

  // Handle errors specific to casino operations
  async handleError(error: Error): Promise<void> {
    secureLogger.error('🎰 Casino payment error', {
      error: error.message,
      casinoId: this.config.casinoId
    });

    // Notify casino monitoring system
    await this.notifyCasinoSystem({
      type: 'PAYMENT_ERROR',
      error: error.message,
      timestamp: new Date().toISOString()
    });

    // Display user-friendly error in casino interface
    throw new UPPError(
      'CASINO_PAYMENT_ERROR',
      `Casino payment failed: ${error.message}`,
      { casinoId: this.config.casinoId }
    );
  }

  // Display payment UI in casino interface
  async displayPaymentUI(options: { amount: number; currency: string }): Promise<void> {
    secureLogger.info('🎰 Displaying casino payment UI', options);

    // This would trigger the casino frontend to show payment modal
    // Implementation depends on your Laravel frontend framework
  }

  // Validate transaction against casino rules
  async validateCasinoTransaction(
    amount: number,
    playerId: string,
    type: 'deposit' | 'withdrawal'
  ): Promise<{ valid: boolean; reason?: string }> {
    // Check maximum amounts
    const maxAmount = type === 'deposit'
      ? this.config.maxDepositAmount
      : this.config.maxWithdrawalAmount;

    if (amount > maxAmount) {
      return {
        valid: false,
        reason: `Amount exceeds maximum ${type} limit of $${maxAmount}`
      };
    }

    // Check KYC requirements
    if (this.config.kycRequired && amount > 1000) {
      // Would check KYC status from database
      // For now, just log
      secureLogger.info('🎰 KYC check required for large transaction', {
        playerId,
        amount
      });
    }

    return { valid: true };
  }

  // Internal: Log casino transaction
  private async logCasinoTransaction(result: PaymentResult): Promise<void> {
    try {
      secureLogger.info('🎰 Casino transaction logged', {
        transactionId: result.transactionId,
        success: result.success,
        amount: result.amount,
        currency: result.currency,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      secureLogger.error('Failed to log casino transaction', { error });
    }
  }

  // Internal: Notify casino backend system
  private async notifyCasinoSystem(notification: any): Promise<void> {
    try {
      // This would send a webhook or message to your Laravel casino backend
      secureLogger.info('🎰 Casino system notification', notification);

      // TODO: Implement actual webhook/notification to Laravel
      // await fetch(`${CASINO_WEBHOOK_URL}/notifications`, {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(notification)
      // });
    } catch (error) {
      secureLogger.error('Failed to notify casino system', { error });
    }
  }

  // Get casino configuration
  getConfig(): CasinoDeviceConfig {
    return { ...this.config };
  }

  // Update casino configuration
  updateConfig(updates: Partial<CasinoDeviceConfig>): void {
    this.config = { ...this.config, ...updates };
    secureLogger.info('🎰 Casino configuration updated', {
      casinoId: this.config.casinoId,
      updates: Object.keys(updates)
    });
  }
}
