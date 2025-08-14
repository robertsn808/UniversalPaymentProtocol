// Universal Payment Protocol Translator - Kai's UPP System
// The brain that translates between ANY device and payment systems! 🌊

import { UPPDevice, DeviceCapabilities, PaymentRequest, PaymentResult, MobileResponse, IoTResponse, VoiceResponse, TVResponse } from './types';
import secureLogger from '../../../shared/logger.js';
import { UPPTracing, MetricRecorders } from '../../../monitoring/metrics.js';

export class UPPTranslator {
  
  // Translate raw device input to universal payment request
  translateInput(rawInput: Record<string, unknown>, capabilities: DeviceCapabilities): PaymentRequest {
    const span = UPPTracing.createPaymentSpan('translate_input', {
      'upp.device.input_method': capabilities.inputMethods?.[0] || 'unknown',
      'upp.device.has_display': capabilities.display || false,
    });

    try {
      secureLogger.info('🔄 Translating device input to universal format...', { input: rawInput });
      
      // Extract payment data from raw input
      const paymentData = this.extractPaymentData(rawInput);
      
      // Create universal payment request
      const paymentRequest: PaymentRequest = {
        amount: (paymentData.amount as number) || 0,
        currency: (paymentData.currency as string) || 'USD',
        description: (paymentData.description as string) || 'UPP Payment',
        merchantId: (paymentData.merchant_id as string) || 'unknown_merchant',
        location: paymentData.location as { lat?: number; lng?: number; address?: string },
        metadata: paymentData.metadata as Record<string, any>
      };

      // Add payment details to span
      span.setAttributes({
        'upp.payment.amount': paymentRequest.amount,
        'upp.payment.currency': paymentRequest.currency,
        'upp.payment.merchant_id': paymentRequest.merchantId,
      });

      secureLogger.info('✅ Input translation complete:', { request: paymentRequest });
      return paymentRequest;
    } finally {
      span.end();
    }
  }

  // Translate payment result to device-specific response
  translateOutput(result: PaymentResult, device: UPPDevice): Record<string, unknown> {
    const span = UPPTracing.createPaymentSpan('translate_output', {
      'upp.device.type': device.getDeviceType(),
      'upp.payment.status': result.status,
      'upp.payment.amount': result.amount,
    });

    try {
      secureLogger.info(`🔄 Translating payment result for ${device.getDeviceType()}...`);
    
    // Route to device-specific response formatter
    switch (device.getDeviceType()) {
      case 'smartphone':
        return this.createMobileResponse(result, device) as unknown as Record<string, unknown>;
      case 'smart_tv':
        return this.createTVResponse(result, device) as unknown as Record<string, unknown>;
      case 'iot_device':
        return this.createIoTResponse(result, device) as unknown as Record<string, unknown>;
      case 'voice_assistant':
        return this.createVoiceResponse(result, device) as unknown as Record<string, unknown>;
      case 'gaming_controller':
        return this.createGamingResponse(result, device);
      default:
        return this.createGenericResponse(result, device);
    }
    } finally {
      span.end();
    }
  }

  // Translate error to device-specific format
  translateError(error: Error, device: UPPDevice): Record<string, unknown> {
    secureLogger.info(`🔄 Translating error for ${device.getDeviceType()}...`);
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Route to device-specific error formatter
    switch (device.getDeviceType()) {
      case 'smartphone':
        return {
          success: false,
          message: errorMessage,
          notification: {
            title: 'Payment Error',
            body: errorMessage,
            icon: '❌'
          },
          vibrationPattern: 'error_pattern'
        };
      case 'smart_tv':
        return {
          success: false,
          fullScreenDisplay: true,
          displayDuration: 5000,
          content: {
            title: 'Payment Error',
            message: errorMessage
          },
          audioFeedback: {
            playSound: true,
            soundType: 'error',
            volume: 0.7
          }
        };
      case 'iot_device':
        return {
          success: false,
          deviceCount: 1,
          status: 'error',
          ledPattern: 'error_red',
          displayText: 'ERROR',
          beepPattern: 'error_beep'
        };
      case 'voice_assistant':
        return {
          success: false,
          message: `Sorry, there was an error: ${errorMessage}`,
          shouldEndSession: true
        };
      case 'gaming_controller':
        return {
          success: false,
          overlayMessage: `Error: ${errorMessage}`,
          hapticPattern: 'error_rumble'
        };
      default:
        return {
          success: false,
          message: errorMessage,
          error: errorMessage
        };
    }
  }

  // Private helper methods for input parsing

  private extractPaymentData(rawInput: Record<string, unknown>): Record<string, unknown> {
    // Extract payment data based on input type
    if (rawInput.type === 'nfc_tap') {
      return this.parseNFCInput(rawInput);
    } else if (rawInput.type === 'qr_scan') {
      return this.parseQRInput(rawInput);
    } else if (rawInput.type === 'voice_command') {
      return this.parseVoiceInput(rawInput);
    } else if (rawInput.type === 'manual_entry') {
      return this.parseManualInput(rawInput);
    } else if (rawInput.type === 'sensor_trigger') {
      return this.parseSensorInput(rawInput);
    } else if (rawInput.type === 'controller_input') {
      return this.parseControllerInput(rawInput);
    } else if (rawInput.type === 'qr_display') {
      return this.parseQRDisplayInput(rawInput);
    } else {
      // Generic input parsing
      return this.parseGenericInput(rawInput);
    }
  }

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
      success: result.success,
      message: result.success ? 'Payment successful!' : 'Payment failed',
      displayDuration: 3000,
      requiresUserAction: !result.success,
      vibrationPattern: result.success ? 'success_pattern' : 'error_pattern',
      notification: {
        title: result.success ? 'Payment Successful' : 'Payment Failed',
        body: result.success ? 
          `$${result.amount} payment completed` : 
          result.error || 'Payment processing failed',
        icon: result.success ? '✅' : '❌'
      },
      metadata: {
        transactionId: result.transactionId,
        amount: result.amount
      }
    };
  }

  private createTVResponse(result: PaymentResult, device: UPPDevice): TVResponse {
    return {
      success: result.success,
      fullScreenDisplay: true,
      displayDuration: 5000,
      content: {
        title: result.success ? 'Payment Successful!' : 'Payment Failed',
        message: result.success ? 
          `$${result.amount} - Transaction: ${result.transactionId}` : 
          result.error || 'Please try again',
        amount: result.success ? `$${result.amount}` : undefined
      },
      audioFeedback: {
        playSound: true,
        soundType: result.success ? 'success' : 'error',
        volume: 0.7
      },
      metadata: {
        transactionId: result.transactionId
      }
    };
  }

  private createIoTResponse(result: PaymentResult, device: UPPDevice): IoTResponse {
    return {
      success: result.success,
      deviceCount: 1,
      status: result.success ? 'completed' : 'failed',
      ledPattern: result.success ? 'success_green' : 'error_red',
      displayText: result.success ? 'PAID' : 'ERROR',
      beepPattern: result.success ? 'success_beep' : 'error_beep',
      metadata: {
        transactionId: result.transactionId,
        amount: result.amount
      }
    };
  }

  private createVoiceResponse(result: PaymentResult, device: UPPDevice): VoiceResponse {
    const message = result.success ? 
      `Your payment of $${result.amount} was successful. Transaction ID ${result.transactionId}` :
      `Sorry, your payment failed. ${result.error}`;
    
    return {
      success: result.success,
      message,
      shouldEndSession: !result.success,
      metadata: {
        transactionId: result.transactionId,
        amount: result.amount
      }
    };
  }

  private createGamingResponse(result: PaymentResult, device: UPPDevice): Record<string, unknown> {
    return {
      type: 'gaming_response',
      success: result.success,
      message: result.success ? 'Purchase complete! Starting download...' : 'Purchase failed',
      transaction_id: result.transactionId,
      controller_vibration: result.success ? 'success_rumble' : 'error_rumble',
      ui_overlay: {
        title: result.success ? 'Purchase Successful' : 'Purchase Failed',
        description: result.success ? 
          `$${result.amount} - Download starting` : 
          result.error,
        duration: 9000
      }
    };
  }

  private createGenericResponse(result: PaymentResult, device: UPPDevice): Record<string, unknown> {
    return {
      type: 'generic_response',
      success: result.success,
      message: result.success ? 'Payment successful' : 'Payment failed',
      transaction_id: result.transactionId,
      amount: result.amount,
      error: result.error
    };
  }
}
