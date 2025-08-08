// Smartphone Device Adapter - Kai's UPP System
// Making phones into universal payment terminals! 📱

import { UPPDevice, PaymentRequest, PaymentResult, UserInput, DeviceCapabilities, SecurityContext, MobileResponse, PaymentUIOptions } from '../core/types.js';
import { UPPError } from '../../../utils/errors.js';
import { secureLogger } from '../../../shared/logger.js';

export class SmartphoneAdapter implements UPPDevice {
  deviceType = 'smartphone';
  fingerprint: string;
  
  getDeviceId(): string {
    return `smartphone_${this.fingerprint}`;
  }

  getDeviceType(): string {
    return this.deviceType;
  }

  getCapabilities(): DeviceCapabilities {
    return {
      hasDisplay: true,
      hasCamera: true,
      hasNFC: true,
      hasBluetooth: true,
      hasWiFi: true,
      hasKeypad: false,
      hasTouchScreen: true,
      hasVoiceInput: true,
      hasVoiceOutput: true,
      hasPrinter: false,
      supportsEncryption: true,
      internet_connection: true,
      maxPaymentAmount: 1000000, // $10,000
      supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'JPY'],
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
      userAuthentication: 'biometric_or_pin',
      trustedEnvironment: true
    };
  }

  constructor(private deviceInfo: Record<string, unknown>) {
    this.fingerprint = this.generateFingerprint();
  }

  // Handle different types of smartphone payment inputs
  async captureUserInput(): Promise<UserInput> {
    // This would integrate with the phone's native capabilities
    return new Promise((resolve) => {
      // Simulate different input methods
      const inputMethods = [
        this.handleNFCTap(),
        this.handleQRScan(),
        this.handleVoiceCommand(),
        this.handleManualEntry(),
        this.handleBiometricAuth()
      ];

      // Return the first successful input
      void Promise.race(inputMethods).then(resolve);
    });
  }

  async handlePaymentResponse(response: PaymentResult): Promise<MobileResponse> {
    secureLogger.info('📱 Smartphone received payment response:', { success: response.success, amount: response.amount });
    
    // Show native notification based on result
    this.showNotification({
      title: response.success ? 'Payment Successful' : 'Payment Failed',
      body: response.success ? `$${response.amount} processed successfully` : (response.error ?? 'Payment failed'),
      icon: response.success ? '✅' : '❌'
    });

    // Vibrate based on result
    this.vibrate(response.success ? 'success_pattern' : 'error_pattern');

    // Update UI
    this.updatePaymentUI(response);

    // Return mobile response
    return {
      success: response.success,
      message: response.success ? 'Payment successful!' : 'Payment failed',
      displayDuration: 3000,
      requiresUserAction: !response.success,
      vibrationPattern: response.success ? 'success_pattern' : 'error_pattern',
      notification: {
        title: response.success ? 'Payment Successful' : 'Payment Failed',
        body: response.success ? `$${response.amount} processed successfully` : (response.error ?? 'Payment failed'),
        icon: response.success ? '✅' : '❌'
      },
      metadata: {
        transactionId: response.transactionId,
        amount: response.amount
      }
    };
  }

  async handleError(error: Error | string): Promise<void> {
    secureLogger.error('📱 Smartphone handling error:', { error: error instanceof Error ? error.message : error });
    
    // Show error notification
    this.showNotification({
      title: 'Payment Error',
      body: error instanceof Error ? error.message : error,
      icon: '❌'
    });

    // Error vibration pattern
    this.vibrate('error_pattern');
  }

  async displayPaymentUI(options: PaymentUIOptions): Promise<void> {
    // This would show the payment interface on the phone
    secureLogger.info('📱 Displaying payment UI:', { amount: options.amount, currency: options.currency });
    
    // Could integrate with:
    // - Apple Pay / Google Pay
    // - Custom payment form
    // - QR code scanner
    // - NFC reader interface
  }

  // NFC Payment Handling
  private async handleNFCTap(): Promise<UserInput> {
    return new Promise((resolve) => {
      // Listen for NFC tap
      // This would integrate with phone's NFC API
      setTimeout(() => {
        resolve({
          type: 'card',
          data: {
            method: 'nfc_tap',
            card_data: 'encrypted_card_info'
          },
          timestamp: Date.now()
        });
      }, 2000);
    });
  }

  // QR Code Scanning
  private async handleQRScan(): Promise<UserInput> {
    return new Promise((resolve) => {
      // Open camera for QR scanning
      // This would use phone's camera API
      setTimeout(() => {
        resolve({
          type: 'qr_scan',
          data: {
            qr_data: {
              amount: 25.99,
              merchant: 'Hawaii Coffee Shop',
              merchant_id: 'hcs_001'
            }
          },
          timestamp: Date.now()
        });
      }, 9000);
    });
  }

  // Voice Command Processing
  private async handleVoiceCommand(): Promise<UserInput> {
    return new Promise((resolve) => {
      // Listen for voice input
      // This would use phone's speech recognition
      setTimeout(() => {
        resolve({
          type: 'voice_command',
          data: {
            transcript: 'Pay twenty five dollars to Hawaii Coffee Shop',
            confidence: 0.95,
            language: 'en-US'
          },
          timestamp: Date.now()
        });
      }, 4000);
    });
  }

  // Manual Entry (typing)
  private async handleManualEntry(): Promise<UserInput> {
    return new Promise((resolve) => {
      // Show manual entry form
      setTimeout(() => {
        resolve({
          type: 'manual_entry',
          data: {
            amount: 25.99,
            merchant_id: 'manual_merchant',
            card_number: '****-****-****-1234',
            payment_method: 'credit_card'
          },
          timestamp: Date.now()
        });
      }, 5000);
    });
  }

  // Biometric Authentication
  private async handleBiometricAuth(): Promise<UserInput> {
    return new Promise((resolve) => {
      // Use fingerprint/face recognition
      setTimeout(() => {
        resolve({
          type: 'biometric_auth',
          data: {
            auth_method: 'fingerprint',
            auth_success: true,
            user_id: 'user_12345'
          },
          timestamp: Date.now()
        });
      }, 1500);
    });
  }

  private showNotification(notification: { title: string; body: string; icon?: string }): void {
    // Show native phone notification
    secureLogger.info('🔔 Notification:', { title: notification.title, body: notification.body });
  }

  private vibrate(pattern: string): void {
    // Trigger phone vibration
    const patterns: Record<string, number[]> = {
      success_pattern: [100, 50, 100],
      error_pattern: [200, 100, 200, 100, 200],
      default: [100]
    };
    
    const selectedPattern = patterns[pattern] ?? patterns.default;
    secureLogger.info('📳 Vibrating with pattern:', { pattern, duration: selectedPattern?.join(',') ?? 'default' });
  }

  private updatePaymentUI(response: PaymentResult): void {
    // Update the payment interface
    secureLogger.info('🔄 Updating UI:', { success: response.success, amount: response.amount });
  }

  private generateFingerprint(): string {
    // Create unique device fingerprint
    const deviceData = {
      model: this.deviceInfo.model ?? 'unknown',
      os: this.deviceInfo.os ?? 'unknown',
      screen: this.deviceInfo.screen ?? 'unknown',
      timestamp: Date.now()
    };
    
    return `smartphone_${btoa(JSON.stringify(deviceData))}`;
  }
}
