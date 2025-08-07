// Universal Payment Protocol Translator - Kai's UPP System
// The brain that translates between ANY device and payment systems! 🌊

import { UPPDevice, DeviceCapabilities, PaymentRequest, PaymentResult, MobileResponse, IoTResponse, VoiceResponse, TVResponse } from './types';
import secureLogger from '../../../shared/logger.js';

export class UPPTranslator {
  
  // Translate raw device input to universal payment request
  translateInput(rawInput: Record<string, unknown>, capabilities: DeviceCapabilities): PaymentRequest {
    secureLogger.info('🔄 Translating device input to universal format...');
    
    // Extract payment data based on input type
    let paymentData: Record<string, unknown> = {};
    
    if (rawInput.type === 'nfc_tap') {
      paymentData = this.parseNFCInput(rawInput);
    } else if (rawInput.type === 'qr_scan') {
      paymentData = this.parseQRInput(rawInput);
    } else if (rawInput.type === 'voice_command') {
      paymentData = this.parseVoiceInput(rawInput);
    } else if (rawInput.type === 'manual_entry') {
      paymentData = this.parseManualInput(rawInput);
    } else if (rawInput.type === 'sensor_trigger') {
      paymentData = this.parseSensorInput(rawInput);
    } else if (rawInput.type === 'controller_input') {
      paymentData = this.parseControllerInput(rawInput);
    } else if (rawInput.type === 'qr_display') {
      paymentData = this.parseQRDisplayInput(rawInput);
    } else {
      // Generic input parsing
      paymentData = this.parseGenericInput(rawInput);
    }

    // Create universal payment request
    const paymentRequest: PaymentRequest = {
      amount: (paymentData.amount as number) || 0,
      currency: (paymentData.currency as string) || 'USD',
      description: (paymentData.description as string) || 'UPP Payment',
      merchant_id: (paymentData.merchant_id as string) || 'unknown_merchant',
      location: paymentData.location as { lat?: number; lng?: number; address?: string } | undefined,
      metadata: {
        input_type: rawInput.type as string,
        device_capabilities: JSON.stringify(capabilities),
        original_input: JSON.stringify(rawInput),
        timestamp: new Date().toISOString(),
        confidence: JSON.stringify(paymentData.confidence)
      }
    };

    secureLogger.info(`✅ Translated to: $${paymentRequest.amount} ${paymentRequest.currency}`);
    return paymentRequest;
  }

  // Translate payment result to device-specific response
  translateOutput(result: PaymentResult, device: UPPDevice): Record<string, unknown> {
    secureLogger.info(`🔄 Translating payment result for ${device.deviceType}...`);
    
    switch (device.deviceType) {
      case 'smartphone':
        return this.createMobileResponse(result, device) as unknown as Record<string, unknown>;
      
      case 'smart_tv':
        return this.createTVResponse(result, device) as unknown as Record<string, unknown>;
      
      case 'iot_device':
      case 'smart_fridge':
        return this.createIoTResponse(result, device) as unknown as Record<string, unknown>;
      
      case 'voice_assistant':
        return this.createVoiceResponse(result, device) as unknown as Record<string, unknown>;
      
      case 'gaming_console':
        return this.createGamingResponse(result, device);
      
      default:
        return this.createGenericResponse(result, device);
    }
  }

  // Translate error to device-specific format
  translateError(error: Error, device: UPPDevice): Record<string, unknown> {
    secureLogger.info(`🔄 Translating error for ${device.deviceType}...`);
    
    const baseError = {
      success: false,
      error_message: error.message,
      timestamp: new Date().toISOString()
    };

    switch (device.deviceType) {
      case 'smartphone':
        return {
          ...baseError,
          type: 'mobile_response',
          vibration: 'error_pattern',
          notification: {
            title: 'Payment Failed',
            body: error.message,
            icon: '❌'
          }
        };
      
      case 'smart_tv':
        return {
          ...baseError,
          type: 'tv_response',
          full_screen_message: {
            title: 'Payment Failed',
            subtitle: error.message,
            background_color: '#ff4444',
            display_duration: 5000
          }
        };
      
      case 'iot_device':
        return {
          ...baseError,
          type: 'iot_response',
          led_pattern: 'error_flash',
          beep_pattern: 'error_beep',
          status_code: 500
        };
      
      case 'voice_assistant':
        return {
          ...baseError,
          type: 'voice_response',
          speech: `Sorry, your payment failed. ${error.message}`,
          should_speak: true
        };
      
      default:
        return baseError;
    }
  }

  // Input parsers for different device types
  private parseNFCInput(input: Record<string, unknown>): Record<string, unknown> {
    return {
      amount: input.amount || 25.99,
      currency: 'USD',
      description: 'NFC Payment',
      merchant_id: input.merchant_id || 'nfc_merchant',
      payment_method: 'nfc'
    };
  }

  private parseQRInput(input: Record<string, unknown>): Record<string, unknown> {
    const qrData = input.qr_data as Record<string, unknown> || {};
    return {
      amount: (qrData.amount as number) || (input.amount as number) || 0,
      currency: 'USD',
      description: `QR Payment - ${(qrData.merchant as string) || 'Unknown Merchant'}`,
      merchant_id: (qrData.merchant_id as string) || (input.merchant_id as string) || 'qr_merchant',
      payment_method: 'qr_code'
    };
  }

  private parseVoiceInput(input: Record<string, unknown>): Record<string, unknown> {
    // Simple voice parsing - in reality this would use NLP
    const transcript = (input.transcript as string).toLowerCase();
    
    // Extract amount from voice command (handle various number formats)
    let amountMatch = transcript.match(/(\d+(?:\.\d{2})?)\s*dollars?/);
    if (!amountMatch) {
      // Try to match written numbers like "fifteen"
      const numberWords: { [key: string]: number } = {
        'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
        'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
        'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
        'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
        'twenty-five': 25, 'thirty': 30, 'fifty': 50, 'hundred': 100
      };
      
      for (const [word, number] of Object.entries(numberWords)) {
        if (transcript.includes(word)) {
          amountMatch = [word, number.toString()];
          break;
        }
      }
    }
    const amount = amountMatch ? parseFloat(amountMatch[1] ?? '0') : 0;
    
    // Extract merchant from voice command
    const merchantMatch = transcript.match(/to\s+([^$]+?)(?:\s+for|$)/);
    const merchant = merchantMatch ? (merchantMatch[1] ?? '').trim() : 'voice_merchant';
    
    return {
      amount,
      currency: 'USD',
      description: `Voice Payment: ${transcript}`,
      merchant_id: merchant.toLowerCase().replace(/\s+/g, '_'),
      payment_method: 'voice',
      confidence: input.confidence
    };
  }

  private parseManualInput(input: Record<string, unknown>): Record<string, unknown> {
    return {
      amount: input.amount ?? 0,
      currency: 'USD',
      description: 'Manual Entry Payment',
      merchant_id: input.merchant_id ?? 'manual_merchant',
      payment_method: input.payment_method ?? 'manual'
    };
  }

  private parseSensorInput(input: Record<string, unknown>): Record<string, unknown> {
    return {
      amount: input.preset_amount ?? input.amount ?? 0,
      currency: 'USD',
      description: input.description ?? 'Automated IoT Payment',
      merchant_id: input.merchant_id ?? 'iot_merchant',
      payment_method: 'sensor_automation',
      trigger: input.trigger
    };
  }

  private parseControllerInput(input: Record<string, unknown>): Record<string, unknown> {
    return {
      amount: input.amount ?? 0,
      currency: 'USD',
      description: input.item ?? 'Gaming Purchase',
      merchant_id: input.merchant_id ?? 'gaming_store',
      payment_method: 'controller'
    };
  }

  private parseQRDisplayInput(input: Record<string, unknown>): Record<string, unknown> {
    return {
      amount: input.amount ?? 0,
      currency: 'USD',
      description: input.service ?? 'TV Service Payment',
      merchant_id: input.merchant_id ?? 'tv_merchant',
      payment_method: 'qr_display'
    };
  }

  private parseGenericInput(input: Record<string, unknown>): Record<string, unknown> {
    return {
      amount: input.amount ?? 0,
      currency: input.currency ?? 'USD',
      description: input.description ?? 'Generic Payment',
      merchant_id: input.merchant_id ?? 'generic_merchant',
      payment_method: 'generic'
    };
  }

  // Response creators for different device types
  private createMobileResponse(result: PaymentResult, device: UPPDevice): MobileResponse {
    return {
      type: 'mobile_response',
      success: result.success,
      message: result.success ? 'Payment successful!' : 'Payment failed',
      transaction_id: result.transaction_id,
      amount: result.amount,
      receipt: result.receipt_data,
      vibration: result.success ? 'success_pattern' : 'error_pattern',
      notification: {
        title: result.success ? 'Payment Successful' : 'Payment Failed',
        body: result.success ? 
          `$${result.amount} payment completed` : 
          result.error_message || 'Payment processing failed',
        icon: result.success ? '✅' : '❌'
      }
    };
  }

  private createTVResponse(result: PaymentResult, device: UPPDevice): TVResponse {
    return {
      type: 'tv_response',
      full_screen_message: {
        title: result.success ? 'Payment Successful!' : 'Payment Failed',
        subtitle: result.success ? 
          `$${result.amount} - Transaction: ${result.transaction_id}` : 
          result.error_message || 'Please try again',
        background_color: result.success ? '#4CAF50' : '#f44336',
        display_duration: 5000
      },
      sound_effect: result.success ? 'success_chime' : 'error_buzz'
    };
  }

  private createIoTResponse(result: PaymentResult, device: UPPDevice): IoTResponse {
    return {
      type: 'iot_response',
      led_pattern: result.success ? 'success_green' : 'error_red',
      display_text: result.success ? 'PAID' : 'ERROR',
      beep_pattern: result.success ? 'success_beep' : 'error_beep',
      status_code: result.success ? 200 : 500
    };
  }

  private createVoiceResponse(result: PaymentResult, device: UPPDevice): VoiceResponse {
    const speech = result.success ? 
      `Your payment of $${result.amount} was successful. Transaction ID ${result.transaction_id}` :
      `Sorry, your payment failed. ${result.error_message}`;
    
    return {
      type: 'voice_response',
      speech,
      display_text: result.success ? 'Payment Successful' : 'Payment Failed',
      should_speak: true
    };
  }

  private createGamingResponse(result: PaymentResult, device: UPPDevice): Record<string, unknown> {
    return {
      type: 'gaming_response',
      success: result.success,
      message: result.success ? 'Purchase complete! Starting download...' : 'Purchase failed',
      transaction_id: result.transaction_id,
      controller_vibration: result.success ? 'success_rumble' : 'error_rumble',
      ui_overlay: {
        title: result.success ? 'Purchase Successful' : 'Purchase Failed',
        description: result.success ? 
          `$${result.amount} - Download starting` : 
          result.error_message,
        duration: 9000
      }
    };
  }

  private createGenericResponse(result: PaymentResult, device: UPPDevice): Record<string, unknown> {
    return {
      type: 'generic_response',
      success: result.success,
      message: result.success ? 'Payment successful' : 'Payment failed',
      transaction_id: result.transaction_id,
      amount: result.amount,
      error_message: result.error_message
    };
  }
}
