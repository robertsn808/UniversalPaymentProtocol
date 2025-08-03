// Universal Payment Protocol Translator - Kai's UPP System
// Translates between different device inputs and standard payment requests

import { PaymentRequest, PaymentResult, UPPDevice } from './types';

export interface TranslationResult {
  standardRequest: PaymentRequest;
  deviceContext: any;
  translationMetadata: {
    originalFormat: string;
    translatedAt: Date;
    confidence: number;
  };
}

export class UPPTranslator {
  private deviceAdapters: Map<string, UPPDevice> = new Map();

  constructor() {
    console.log('🔄 UPP Translator initialized');
  }

  // Register a device adapter
  registerDeviceAdapter(deviceType: string, adapter: UPPDevice): void {
    this.deviceAdapters.set(deviceType, adapter);
    console.log(`✅ Device adapter registered for: ${deviceType}`);
  }

  // Translate device-specific input to standard payment request
  async translateToPaymentRequest(
    deviceType: string,
    deviceInput: any,
    deviceContext?: any
  ): Promise<TranslationResult> {
    const adapter = this.deviceAdapters.get(deviceType);
    
    if (!adapter) {
      throw new Error(`No adapter found for device type: ${deviceType}`);
    }

    // Extract common payment fields from device input
    const standardRequest: PaymentRequest = {
      amount: this.extractAmount(deviceInput),
      currency: this.extractCurrency(deviceInput) || 'USD',
      description: this.extractDescription(deviceInput) || 'Universal Payment',
      merchant_id: this.extractMerchantId(deviceInput) || 'unknown',
      location: this.extractLocation(deviceInput),
      metadata: {
        device_type: deviceType,
        original_input: deviceInput,
        device_capabilities: adapter.capabilities,
        security_context: adapter.securityContext,
        ...deviceContext
      }
    };

    return {
      standardRequest,
      deviceContext: deviceContext || {},
      translationMetadata: {
        originalFormat: this.detectInputFormat(deviceInput),
        translatedAt: new Date(),
        confidence: this.calculateTranslationConfidence(deviceInput, deviceType)
      }
    };
  }

  // Translate payment result back to device-specific format
  async translateFromPaymentResult(
    deviceType: string,
    paymentResult: PaymentResult,
    originalInput?: any
  ): Promise<any> {
    const adapter = this.deviceAdapters.get(deviceType);
    
    if (!adapter) {
      throw new Error(`No adapter found for device type: ${deviceType}`);
    }

    // Create device-specific response format
    const deviceResponse = {
      success: paymentResult.success,
      amount: paymentResult.amount,
      currency: paymentResult.currency,
      transaction_id: paymentResult.transaction_id,
      status: paymentResult.status,
      device_specific: this.createDeviceSpecificResponse(deviceType, paymentResult),
      display_format: this.formatForDevice(deviceType, paymentResult),
      actions: this.getDeviceActions(deviceType, paymentResult)
    };

    return deviceResponse;
  }

  // Extract amount from various input formats
  private extractAmount(input: any): number {
    if (typeof input === 'number') return input;
    if (input.amount) return input.amount;
    if (input.value) return input.value;
    if (input.price) return input.price;
    if (input.total) return input.total;
    
    // Try to parse from string formats
    if (typeof input === 'string') {
      const match = input.match(/\$?(\d+\.?\d*)/);
      if (match) return parseFloat(match[1]);
    }
    
    // Voice/text parsing
    if (input.transcript) {
      const words = input.transcript.toLowerCase().split(' ');
      for (let i = 0; i < words.length; i++) {
        if (words[i].includes('dollar') && i > 0) {
          const amount = parseFloat(words[i - 1]);
          if (!isNaN(amount)) return amount;
        }
      }
    }
    
    return 0;
  }

  // Extract currency from input
  private extractCurrency(input: any): string | null {
    if (input.currency) return input.currency;
    
    // Check for currency symbols or codes
    if (typeof input === 'string') {
      if (input.includes('$')) return 'USD';
      if (input.includes('€')) return 'EUR';
      if (input.includes('£')) return 'GBP';
      if (input.includes('¥')) return 'JPY';
    }
    
    return null;
  }

  // Extract description from input
  private extractDescription(input: any): string | null {
    if (input.description) return input.description;
    if (input.memo) return input.memo;
    if (input.note) return input.note;
    if (input.item) return input.item;
    if (input.service) return input.service;
    
    // From voice transcript
    if (input.transcript) {
      return `Voice payment: ${input.transcript}`;
    }
    
    return null;
  }

  // Extract merchant ID from input
  private extractMerchantId(input: any): string | null {
    if (input.merchant_id) return input.merchant_id;
    if (input.merchantId) return input.merchantId;
    if (input.merchant) return input.merchant;
    if (input.store) return input.store;
    if (input.vendor) return input.vendor;
    
    return null;
  }

  // Extract location from input
  private extractLocation(input: any): any {
    if (input.location) return input.location;
    if (input.coordinates) return input.coordinates;
    if (input.lat && input.lng) {
      return { lat: input.lat, lng: input.lng };
    }
    
    return null;
  }

  // Detect input format type
  private detectInputFormat(input: any): string {
    if (input.type) return input.type;
    
    if (input.transcript) return 'voice_command';
    if (input.qr_data) return 'qr_code';
    if (input.card_data) return 'nfc_tap';
    if (input.controller_input) return 'controller_navigation';
    if (input.sensor_trigger) return 'iot_sensor';
    
    return 'unknown';
  }

  // Calculate translation confidence
  private calculateTranslationConfidence(input: any, deviceType: string): number {
    let confidence = 0.5; // Base confidence
    
    // Higher confidence for structured inputs
    if (input.amount && input.merchant_id) confidence += 0.3;
    if (input.currency) confidence += 0.1;
    if (input.location) confidence += 0.1;
    
    // Device-specific confidence boosts
    switch (deviceType) {
      case 'smartphone':
        if (input.type === 'nfc_tap' || input.type === 'qr_scan') confidence += 0.2;
        break;
      case 'voice_assistant':
        if (input.confidence && input.confidence > 0.9) confidence += 0.2;
        break;
      case 'smart_tv':
        if (input.type === 'qr_display') confidence += 0.15;
        break;
    }
    
    return Math.min(confidence, 1.0);
  }

  // Create device-specific response
  private createDeviceSpecificResponse(deviceType: string, result: PaymentResult): any {
    switch (deviceType) {
      case 'smartphone':
        return {
          notification: {
            title: result.success ? 'Payment Successful' : 'Payment Failed',
            body: `$${result.amount} ${result.currency}`,
            vibration: result.success ? 'success_pattern' : 'error_pattern'
          }
        };
      
      case 'smart_tv':
        return {
          full_screen_display: {
            title: result.success ? '✅ Payment Complete' : '❌ Payment Failed',
            amount: `$${result.amount} ${result.currency}`,
            transaction_id: result.transaction_id
          }
        };
      
      case 'voice_assistant':
        return {
          speech_response: result.success 
            ? `Payment of $${result.amount} was successful. Transaction ID ${result.transaction_id}`
            : `Sorry, your payment of $${result.amount} could not be processed.`
        };
      
      case 'iot_device':
        return {
          led_status: result.success ? 'green_flash' : 'red_flash',
          status_code: result.success ? 200 : 400
        };
      
      case 'gaming_console':
        return {
          game_overlay: {
            message: result.success ? 'Purchase Complete!' : 'Purchase Failed',
            amount: `$${result.amount}`,
            auto_dismiss: 3000
          }
        };
      
      default:
        return {
          generic_response: {
            success: result.success,
            message: result.success ? 'Payment processed' : 'Payment failed'
          }
        };
    }
  }

  // Format result for specific device display
  private formatForDevice(deviceType: string, result: PaymentResult): string {
    const baseFormat = `${result.success ? '✅' : '❌'} $${result.amount} ${result.currency}`;
    
    switch (deviceType) {
      case 'smart_tv':
        return `${baseFormat}\nTransaction: ${result.transaction_id}`;
      case 'voice_assistant':
        return result.success 
          ? `Payment successful: ${result.amount} dollars`
          : `Payment failed: ${result.amount} dollars`;
      default:
        return baseFormat;
    }
  }

  // Get device-specific actions
  private getDeviceActions(deviceType: string, result: PaymentResult): string[] {
    const actions: string[] = [];
    
    if (result.success) {
      switch (deviceType) {
        case 'smartphone':
          actions.push('show_receipt', 'add_to_wallet', 'share_payment');
          break;
        case 'smart_tv':
          actions.push('display_receipt', 'return_to_app');
          break;
        case 'voice_assistant':
          actions.push('speak_confirmation', 'save_to_history');
          break;
        case 'iot_device':
          actions.push('log_transaction', 'update_inventory');
          break;
        case 'gaming_console':
          actions.push('start_download', 'add_to_library');
          break;
      }
    } else {
      actions.push('retry_payment', 'contact_support');
    }
    
    return actions;
  }
}

// Hey, this is Kai speaking now! 🌊
// This UPP Translator is the heart of our universal payment system!
// It takes ANY device input and converts it to a standard payment format
// Then it converts responses back to device-specific formats
// This is how we make payments work on phones, TVs, fridges, cars, ANYTHING! 🚀