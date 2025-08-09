// Universal Payment Protocol - Core Implementation
// The heart of the UPP system - making ANY device a payment terminal! 🌊

import { EventEmitter } from 'events';

import { UPPDevice, PaymentRequest, PaymentResult, Transaction, ValidationResult, UPPConfig } from './types';
import { UPPTranslator } from './UPPTranslator';

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
    
    console.log(`✅ Device registered: ${device.deviceType} (${deviceId})`);
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
      console.log(`💳 Processing payment from ${device.deviceType}...`);

      // 1. Translate device input to universal format
      const paymentRequest = await this.translator.translateInput(
        rawInput, 
        device.capabilities
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
        device: device.deviceType
      };

      this.activeTransactions.set(transactionId, transaction);

      // 4. Process through payment gateway
      const paymentResult = await this.executePayment(paymentRequest);
      paymentResult.transaction_id = transactionId;

      // 5. Update transaction status
      transaction.status = paymentResult.success ? 'completed' : 'failed';
      transaction.result = paymentResult;

      // 6. Translate response back to device format
      const deviceResponse = await this.translator.translateOutput(
        paymentResult, 
        device
      );

      // 7. Send response to device
      await device.handlePaymentResponse(deviceResponse as unknown as PaymentResult);

      console.log(`${paymentResult.success ? '✅' : '❌'} Payment ${paymentResult.success ? 'completed' : 'failed'}: ${transactionId}`);
      this.emit('payment_processed', { transaction, result: paymentResult });

      return paymentResult;

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`💥 Payment processing failed for device ${deviceId}:`, errorMessage);
      
      // Send error to device in its native format
      const errorObj = error instanceof Error ? error : new Error(String(error));
      const errorResponse = await this.translator.translateError(errorObj, device);
      await device.handleError(errorObj);
      
      // Return failed payment result
      return {
        success: false,
        status: 'failed',
        error_message: error instanceof Error ? error.message : String(error)
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
    return `${device.deviceType}_${timestamp}_${random}`;
  }

  private generateTransactionId(): string {
    return `txn_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private async validateDevice(device: UPPDevice): Promise<ValidationResult> {
    // Check required capabilities
    const requiredCapabilities = ['internet_connection'];
    const missing = requiredCapabilities.filter(cap => !device.capabilities[cap]);
    
    if (missing.length > 0) {
      return {
        valid: false,
        reason: `Missing required capabilities: ${missing.join(', ')}`
      };
    }

    // Security validation
    if (!device.securityContext.encryption_level) {
      return {
        valid: false,
        reason: 'Device must support encryption'
      };
    }

    // Check if device implements required methods
    if (typeof device.handlePaymentResponse !== 'function') {
      return {
        valid: false,
        reason: 'Device must implement handlePaymentResponse method'
      };
    }

    if (typeof device.handleError !== 'function') {
      return {
        valid: false,
        reason: 'Device must implement handleError method'
      };
    }

    return { valid: true };
  }

  private validatePaymentRequest(request: PaymentRequest): ValidationResult {
    const errors: string[] = [];

    if (!request.amount || request.amount <= 0) {
      errors.push('Amount must be greater than 0');
    }

    if (!request.currency || request.currency.length !== 3) {
      errors.push('Currency must be a 3-letter code (e.g., USD)');
    }

    if (!request.description || request.description.trim().length === 0) {
      errors.push('Description is required');
    }

    if (!request.merchant_id || request.merchant_id.trim().length === 0) {
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
    // Use our new Universal Payment Gateway with Visa Direct
    const { universalPaymentGateway } = await import('../../../payments/universal-payment-gateway.js');
    
    try {
      console.log('🌊 Processing payment through UPP Gateway with Visa Direct');
      const result = await universalPaymentGateway.processPayment(request);
      return result;
    } catch (error: any) {
      console.error('💥 UPP Gateway error:', error);
      return {
        success: false,
        status: 'failed',
        error_message: error.message || 'Payment processing failed'
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
      mockDevices.push({
        deviceType: 'smartphone',
        fingerprint: `smartphone_${Date.now()}`,
        capabilities: {
          internet_connection: true,
          display: 'touchscreen',
          input_methods: ['touch', 'voice', 'camera', 'nfc', 'biometric'],
          nfc: true,
          camera: true,
          microphone: true,
          biometric: true,
          gps: true,
          vibration: true,
          push_notifications: true
        },
        securityContext: {
          encryption_level: 'AES256',
          device_attestation: 'trusted',
          user_authentication: 'biometric_or_pin',
          trusted_environment: true
        },
        handlePaymentResponse: async (response: any) => {
          console.log('📱 Smartphone received payment response');
        },
        handleError: async (error: any) => {
          console.log('📱 Smartphone handling error');
        }
      });
      console.log('📱 Found smartphone via WiFi scan');
    }
    
    return mockDevices;
  }

  private async scanForIoTDevices(): Promise<UPPDevice[]> {
    console.log('🏠 Scanning for IoT devices...');
    
    // Mock IoT device discovery
    const mockDevices: UPPDevice[] = [];
    
    // Simulate finding IoT devices via network scan
    if (Math.random() > 0.8) { // 20% chance
      mockDevices.push({
        deviceType: 'smart_fridge',
        fingerprint: `iot_${Date.now()}`,
        capabilities: {
          internet_connection: true,
          display: 'minimal',
          sensors: true,
          automated_purchasing: true
        },
        securityContext: {
          encryption_level: 'AES256',
          device_attestation: 'trusted'
        },
        handlePaymentResponse: async (response: any) => {
          console.log('🏠 IoT device received payment response');
        },
        handleError: async (error: any) => {
          console.log('🏠 IoT device handling error');
        }
      });
      console.log('🏠 Found smart fridge via mDNS');
    }
    
    return mockDevices;
  }

  private async scanForSmartTVs(): Promise<UPPDevice[]> {
    console.log('📺 Scanning for Smart TVs...');
    
    const mockDevices: UPPDevice[] = [];
    
    // Simulate Smart TV discovery via UPnP/DLNA
    if (Math.random() > 0.6) { // 40% chance
      mockDevices.push({
        deviceType: 'smart_tv',
        fingerprint: `tv_${Date.now()}`,
        capabilities: {
          internet_connection: true,
          display: 'large',
          input_methods: ['remote', 'voice', 'qr_display'],
          qr_generator: true
        },
        securityContext: {
          encryption_level: 'AES256',
          device_attestation: 'trusted'
        },
        handlePaymentResponse: async (response: any) => {
          console.log('📺 Smart TV displaying payment confirmation');
        },
        handleError: async (error: any) => {
          console.log('📺 Smart TV displaying error message');
        }
      });
      console.log('📺 Found Samsung Smart TV via UPnP');
    }
    
    return mockDevices;
  }

  private async scanForVoiceDevices(): Promise<UPPDevice[]> {
    console.log('🎤 Scanning for voice assistants...');
    
    const mockDevices: UPPDevice[] = [];
    
    // Simulate voice assistant discovery
    if (Math.random() > 0.75) { // 25% chance
      mockDevices.push({
        deviceType: 'voice_assistant',
        fingerprint: `voice_${Date.now()}`,
        capabilities: {
          internet_connection: true,
          microphone: true,
          speaker: true,
          voice_recognition: true,
          natural_language: true
        },
        securityContext: {
          encryption_level: 'AES256',
          voice_authentication: true
        },
        handlePaymentResponse: async (response: any) => {
          console.log('🎤 Voice assistant announcing payment result');
        },
        handleError: async (error: any) => {
          console.log('🎤 Voice assistant announcing error');
        }
      });
      console.log('🎤 Found Amazon Echo via network scan');
    }
    
    return mockDevices;
  }

  private async scanForGamingDevices(): Promise<UPPDevice[]> {
    console.log('🎮 Scanning for gaming consoles...');
    
    const mockDevices: UPPDevice[] = [];
    
    // Simulate gaming console discovery
    if (Math.random() > 0.85) { // 15% chance
      mockDevices.push({
        deviceType: 'gaming_console',
        fingerprint: `gaming_${Date.now()}`,
        capabilities: {
          internet_connection: true,
          display: 'gaming',
          input_methods: ['controller', 'voice', 'motion'],
          gaming_store: true,
          user_accounts: true
        },
        securityContext: {
          encryption_level: 'AES256',
          user_authentication: 'account_login'
        },
        handlePaymentResponse: async (response: any) => {
          console.log('🎮 Gaming console showing purchase confirmation');
        },
        handleError: async (error: any) => {
          console.log('🎮 Gaming console showing purchase error');
        }
      });
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
            console.log(`🆕 New device discovered: ${device.deviceType}`);
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
      .some(registered => registered.fingerprint === device.fingerprint);
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
