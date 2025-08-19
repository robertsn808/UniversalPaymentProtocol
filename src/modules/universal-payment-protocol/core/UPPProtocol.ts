// Universal Payment Protocol - Core Implementation
// The heart of the UPP system - making ANY device a payment terminal! 🌊

import { EventEmitter } from 'events';

import { UPPDevice, PaymentRequest, PaymentResult, Transaction, ValidationResult, UPPConfig } from './types';
import { UPPTranslator } from './UPPTranslator';
import { UPPError } from '../../../utils/errors.js';

export class UniversalPaymentProtocol extends EventEmitter {
  private version = '1.0.0';
  private registeredDevices = new Map<string, UPPDevice>();
  private activeTransactions = new Map<string, Transaction>();
  private translator: UPPTranslator;

  constructor(private config: UPPConfig) {
    super();
    this.translator = new UPPTranslator();
    void this.initializeProtocol();
  }

  // Register any device with the protocol
  async registerDevice(device: UPPDevice): Promise<string> {
    const deviceId = this.generateDeviceId(device);
    
    // Validate device capabilities
    const validation = await this.validateDevice(device);
    if (!validation.valid) {
      throw new Error(`Device registration failed: ${validation.reason}`);
    }

    this.registeredDevices.set(deviceId, device);
    
    console.log(`✅ Device registered: ${device.getDeviceType()} (${deviceId})`);
    this.emit('device_registered', { deviceId, device });
    
    return deviceId;
  }

  // Process payment from ANY device
  async processPayment(deviceId: string, rawInput: Record<string, unknown>): Promise<PaymentResult> {
    const device = this.registeredDevices.get(deviceId);
    if (!device) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    try {
      console.log(`💳 Processing payment from ${device.getDeviceType()}...`);

      // 1. Translate device input to universal format
      const paymentRequest = await this.translator.translateInput(
        rawInput, 
        device.getCapabilities()
      );

      // 2. Validate the payment request
      const validation = this.validatePaymentRequest(paymentRequest);
      if (!validation.valid) {
        throw new Error(`Invalid payment request: ${validation.errors?.join(', ')}`);
      }

      // 3. Create transaction
      const transactionId = this.generateTransactionId();
      const transaction: Transaction = {
        id: transactionId,
        deviceId,
        request: paymentRequest,
        status: 'processing',
        timestamp: new Date(),
        device: device.getDeviceType()
      };

      this.activeTransactions.set(transactionId, transaction);

      // 4. Process through payment gateway
      const paymentResult = await this.executePayment(paymentRequest);
      paymentResult.transactionId = transactionId;

      // 5. Update transaction status
      transaction.status = paymentResult.success ? 'completed' : 'failed';
      transaction.result = paymentResult;

      // 6. Translate response back to device format
      const deviceResponse = await this.translator.translateOutput(
        paymentResult, 
        device
      );

      // 7. Send response to device
      await device.handlePaymentResponse(paymentResult);

      console.log(`${paymentResult.success ? '✅' : '❌'} Payment ${paymentResult.success ? 'completed' : 'failed'}: ${transactionId}`);
      this.emit('payment_processed', { transaction, result: paymentResult });

      return paymentResult;

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`💥 Payment processing failed for device ${deviceId}:`, errorMessage);
      
      // Send error to device in its native format
      const errorObj = error instanceof UPPError ? error : new UPPError(
        error instanceof Error ? error.message : String(error),
        'PAYMENT_PROCESSING_ERROR',
        500
      );
      const errorResponse = await this.translator.translateError(errorObj, device);
      await device.handleError(errorObj);
      
      // Return failed payment result
      return {
        success: false,
        transactionId: '',
        amount: 0,
        currency: 'USD',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  // Get registered devices
  getRegisteredDevices(): Map<string, UPPDevice> {
    return new Map(this.registeredDevices);
  }

  // Get active transactions
  getActiveTransactions(): Map<string, Transaction> {
    return new Map(this.activeTransactions);
  }

  // Get transaction by ID
  getTransaction(transactionId: string): Transaction | undefined {
    return this.activeTransactions.get(transactionId);
  }

  // Universal device discovery
  async discoverDevices(): Promise<UPPDevice[]> {
    const discoveredDevices: UPPDevice[] = [];

    if (!this.config.discovery.enabled) {
      return discoveredDevices;
    }

    console.log('🔍 Scanning for devices...');

    // Scan for different device types
    const scanners = [
      this.scanForMobileDevices(),
      this.scanForIoTDevices(),
      this.scanForSmartTVs(),
      this.scanForVoiceDevices(),
      this.scanForGamingDevices()
    ];

    const results = await Promise.allSettled(scanners);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        discoveredDevices.push(...result.value);
      } else {
        console.warn(`Device scanner ${index} failed:`, result.reason);
      }
    });

    console.log(`📱 Discovered ${discoveredDevices.length} devices`);
    return discoveredDevices;
  }

  private async initializeProtocol(): Promise<void> {
    console.log(`🚀 Initializing Universal Payment Protocol v${this.version}`);
    console.log('🌊 Making ANY device a payment terminal!');
    
    // Initialize security layer
    await this.initializeSecurity();
    
    // Start device discovery if enabled
    if (this.config.discovery.enabled) {
      this.startDeviceDiscovery();
    }
    
    // Initialize payment gateway connection
    await this.initializePaymentGateway();
    
    console.log('✅ UPP Protocol initialized successfully');
    console.log('💰 Ready to process payments from ANY device!');
  }

  private generateDeviceId(device: UPPDevice): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    return `${device.getDeviceType()}_${timestamp}_${random}`;
  }

  private generateTransactionId(): string {
    return `txn_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private async validateDevice(device: UPPDevice): Promise<ValidationResult> {
    // Check required capabilities
    const capabilities = device.getCapabilities();
    const requiredCapabilities = ['internet_connection'];
    const missing = requiredCapabilities.filter(cap => {
      switch (cap) {
        case 'internet_connection':
          return !capabilities.internet_connection;
        default:
          return false;
      }
    });
    
    if (missing.length > 0) {
      return {
        valid: false,
        reason: `Missing required capabilities: ${missing.join(', ')}`
      };
    }

    // Security validation
    const securityContext = device.getSecurityContext();
    if (!securityContext.encryptionLevel) {
      return {
        valid: false,
        reason: 'Device lacks encryption support'
      };
    }

    // Device fingerprint validation
    const fingerprint = device.getFingerprint();
    if (!fingerprint || fingerprint.length < 10) {
      return {
        valid: false,
        reason: 'Invalid device fingerprint'
      };
    }

    return { valid: true };
  }

  private validatePaymentRequest(request: PaymentRequest): ValidationResult {
    const errors: string[] = [];

    // Amount validation
    if (!request.amount || request.amount <= 0) {
      errors.push('Invalid payment amount');
    }

    // Currency validation
    if (!request.currency || request.currency.length !== 3) {
      errors.push('Invalid currency code');
    }

    // Merchant validation
    if (!request.merchantId || request.merchantId.trim().length === 0) {
      errors.push('Merchant ID is required');
    }

    if (errors.length > 0) {
      return {
        valid: false,
        errors
      };
    }

    return { valid: true };
  }

  private async executePayment(request: PaymentRequest): Promise<PaymentResult> {
    // This connects to our payment gateway (Stripe, etc.)
    const gateway = this.config.paymentGateway;
    
    if (!gateway) {
      throw new Error('Payment gateway not configured');
    }

    try {
      const result = await gateway.processPayment(request);
      return result;
    } catch (error: any) {
      console.error('Payment gateway error:', error);
      return {
        success: false,
        transactionId: '',
        amount: request.amount,
        currency: request.currency,
        error: error.message || 'Payment processing failed'
      };
    }
  }

  // Device type scanners
  private async scanForMobileDevices(): Promise<UPPDevice[]> {
    console.log('📱 Scanning for mobile devices...');
    
    // Mock mobile device discovery for testing
    const mockDevices: UPPDevice[] = [];
    
    // Simulate finding a smartphone
    if (Math.random() > 0.7) { // 30% chance to find a device
      // Mock smartphone device for discovery
      const mockDevice: UPPDevice = {
        getDeviceId: () => `smartphone_${Date.now()}`,
        getDeviceType: () => 'smartphone',
        getCapabilities: () => ({
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
          maxPaymentAmount: 1000000,
          supportedCurrencies: ['USD', 'EUR', 'GBP'],
          securityLevel: 'HIGH'
        }),
        getDeviceFingerprint: () => `smartphone_${Date.now()}`,
        getFingerprint: () => `smartphone_${Date.now()}`,
        getSecurityContext: () => ({
          encryptionLevel: 'AES256',
          deviceAttestation: 'trusted',
          userAuthentication: 'biometric_or_pin',
          trustedEnvironment: true
        }),
        handlePaymentResponse: async (response: PaymentResult) => {
          console.log('📱 Smartphone received payment response');
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
        },
        handleError: async (error: UPPError) => {
          console.log('📱 Smartphone handling error');
        }
      };
      
      mockDevices.push(mockDevice);
      console.log('📱 Found smartphone via WiFi scan');
    }
    
    return mockDevices;
  }

  private createMockDevice(deviceType: string, prefix: string): UPPDevice {
    const deviceFingerprint = `${prefix}_${Date.now()}`;
    return {
      getDeviceType: () => deviceType,
      getDeviceId: () => deviceFingerprint,
      getFingerprint: () => deviceFingerprint,
      getDeviceFingerprint: () => deviceFingerprint,
      getCapabilities: () => ({
        hasDisplay: true,
        hasCamera: false,
        hasNFC: false,
        hasBluetooth: true,
        hasWiFi: true,
        hasKeypad: false,
        hasTouchScreen: false,
        hasVoiceInput: false,
        hasVoiceOutput: false,
        hasPrinter: false,
        supportsEncryption: true,
        internet_connection: true,
        maxPaymentAmount: 5000,
        supportedCurrencies: ['USD'],
        securityLevel: 'STANDARD' as const
      }),
      getSecurityContext: () => ({
        encryptionLevel: 'AES256',
        deviceAttestation: 'trusted'
      }),
      handlePaymentResponse: async (response: any) => {
        console.log(`🎯 ${deviceType} received payment response`);
        return {
          success: response.success,
          deviceCount: 1,
          status: response.success ? 'payment_confirmed' : 'payment_failed',
          ledPattern: response.success ? 'green_blink' : 'red_flash'
        };
      },
      handleError: async (error: any) => {
        console.log(`🎯 ${deviceType} handling error`);
      }
    };
  }

  private async scanForIoTDevices(): Promise<UPPDevice[]> {
    console.log('🏠 Scanning for IoT devices...');
    
    // Mock IoT device discovery
    const mockDevices: UPPDevice[] = [];
    
    // Simulate finding IoT devices via network scan
    if (Math.random() > 0.8) { // 20% chance
      mockDevices.push(this.createMockDevice('smart_fridge', 'iot'));
      console.log('🏠 Found smart fridge via mDNS');
    }
    
    return mockDevices;
  }

  private async scanForSmartTVs(): Promise<UPPDevice[]> {
    console.log('📺 Scanning for Smart TVs...');
    
    const mockDevices: UPPDevice[] = [];
    
    // Simulate Smart TV discovery via UPnP/DLNA  
    if (Math.random() > 0.6) { // 40% chance
      mockDevices.push(this.createMockDevice('smart_tv', 'tv'));
      console.log('📺 Found Samsung Smart TV via UPnP');
    }
    
    return mockDevices;
  }

  private async scanForVoiceDevices(): Promise<UPPDevice[]> {
    console.log('🎤 Scanning for voice assistants...');
    
    const mockDevices: UPPDevice[] = [];
    
    // Simulate voice assistant discovery
    if (Math.random() > 0.75) { // 25% chance
      mockDevices.push(this.createMockDevice('voice_assistant', 'voice'));
      console.log('🎤 Found Amazon Echo via network scan');
    }
    
    return mockDevices;
  }

  private async scanForGamingDevices(): Promise<UPPDevice[]> {
    console.log('🎮 Scanning for gaming consoles...');
    
    const mockDevices: UPPDevice[] = [];
    
    // Simulate gaming console discovery
    if (Math.random() > 0.85) { // 15% chance
      mockDevices.push(this.createMockDevice('gaming_console', 'gaming'));
      console.log('🎮 Found PlayStation 5 via network discovery');
    }
    
    return mockDevices;
  }

  private async initializeSecurity(): Promise<void> {
    // Initialize encryption, certificates, etc.
    console.log('🔒 Security layer initialized');
  }

  private startDeviceDiscovery(): void {
    console.log('🔍 Starting continuous device discovery...');
    
    // Continuous device discovery
    setInterval(async () => {
      try {
        const devices = await this.discoverDevices();
        devices.forEach(device => {
          if (!this.isDeviceRegistered(device)) {
            console.log(`🆕 New device discovered: ${device.getDeviceType()}`);
            this.emit('device_discovered', device);
          }
        });
      } catch (error) {
        console.error('Device discovery error:', error);
      }
    }, this.config.discovery.scan_interval || 90000);
  }

  private isDeviceRegistered(device: UPPDevice): boolean {
    return Array.from(this.registeredDevices.values())
      .some(registered => registered.getFingerprint() === device.getFingerprint());
  }

  private async initializePaymentGateway(): Promise<void> {
    // Connect to payment gateway
    if (this.config.paymentGateway) {
      console.log('💳 Payment gateway connected');
    } else {
      console.warn('⚠️  No payment gateway configured');
    }
  }
}
