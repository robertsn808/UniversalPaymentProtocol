// Universal Payment Protocol - Kai's Revolutionary Payment System
// Making ANY internet-connected device into a payment terminal! 🌊

import { UPPDevice, PaymentRequest, PaymentResult, UPPConfig } from './types';

export class UniversalPaymentProtocol {
  private devices: Map<string, UPPDevice> = new Map();
  private paymentGateway: any;
  private config: UPPConfig;

  constructor(config: UPPConfig) {
    this.config = config;
    this.paymentGateway = config.paymentGateway;
    
    console.log('🌊 Universal Payment Protocol Initialized');
    console.log('💳 Ready to process payments from ANY device!');
  }

  // Register a new device with the UPP system
  async registerDevice(device: UPPDevice): Promise<string> {
    // Validate device has internet connection
    if (!device.capabilities.internet_connection) {
      throw new Error('Device registration failed: No internet connection');
    }

    // Generate unique device ID
    const deviceId = `${device.deviceType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store device in registry
    this.devices.set(deviceId, device);
    
    console.log(`✅ Device registered: ${deviceId} (${device.deviceType})`);
    return deviceId;
  }

  // Process a payment through the UPP system
  async processPayment(deviceId: string, paymentData: any): Promise<PaymentResult> {
    // Get device from registry
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error('Device not found');
    }

    try {
      // Create payment request based on device capabilities
      const request: PaymentRequest = {
        amount: paymentData.amount || 0,
        currency: paymentData.currency || 'USD',
        description: paymentData.description || 'Universal Payment',
        merchant_id: paymentData.merchant_id || 'unknown_merchant',
        location: paymentData.location,
        metadata: {
          device_type: device.deviceType,
          device_id: deviceId,
          ...paymentData.metadata
        }
      };

      console.log(`💳 Processing payment for ${device.deviceType}: $${request.amount}`);

      // Process payment through gateway
      const result = await this.paymentGateway.processPayment(request);
      
      // Handle response based on device type
      if (result.success) {
        await device.handlePaymentResponse(result);
        console.log(`✅ Payment successful for device ${deviceId}`);
      } else {
        await device.handleError(result);
        console.log(`❌ Payment failed for device ${deviceId}`);
      }

      return result;
    } catch (error: any) {
      console.error('💥 Payment processing error:', error);
      await device.handleError({ message: error.message });
      throw error;
    }
  }

  // Get device by ID
  getDevice(deviceId: string): UPPDevice | undefined {
    return this.devices.get(deviceId);
  }

  // Get all registered devices
  getDevices(): Map<string, UPPDevice> {
    return new Map(this.devices);
  }

  // Remove device from registry
  unregisterDevice(deviceId: string): boolean {
    return this.devices.delete(deviceId);
  }
}
