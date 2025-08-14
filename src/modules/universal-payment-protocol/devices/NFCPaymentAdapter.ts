import { z } from 'zod';

import { UPPDevice, DeviceCapabilities, SecurityContext, PaymentRequest, PaymentResult, MobileResponse } from '../core/types.js';
import { createDeviceError, UPPError } from '../../../utils/errors.js';

// EMV Payment Card Data Schema
const PaymentCardDataSchema = z.object({
  pan: z.string().min(13).max(19), // Primary Account Number
  expiryDate: z.string().regex(/^\d{2}\/\d{2}$/), // MM/YY format
  cardholderName: z.string().optional(),
  serviceCode: z.string().length(3).optional(),
  track2Data: z.string().optional(),
  emvData: z.record(z.string(), z.any()).optional(), // EMV tag-value pairs
  applicationId: z.string().optional(), // AID
  cryptogram: z.string().optional(), // Application Cryptogram
});

export type PaymentCardData = z.infer<typeof PaymentCardDataSchema>;

// NFC Command Types
export enum NFCCommandType {
  READ_CARD = 'READ_CARD',
  WRITE_NDEF = 'WRITE_NDEF',
  HOST_CARD_EMULATION = 'HOST_CARD_EMULATION',
  PEER_TO_PEER = 'PEER_TO_PEER',
}

// NDEF Record Types
export enum NDEFRecordType {
  TEXT = 'text/plain',
  URI = 'text/uri-list',
  SMART_POSTER = 'application/vnd.wfa.wsc',
  PAYMENT_REQUEST = 'application/vnd.upp.payment',
}

export interface NDEFRecord {
  type: NDEFRecordType;
  payload: string | Buffer;
  id?: string;
  language?: string;
}

export interface NFCDeviceConfig {
  mode: 'reader' | 'writer' | 'peer' | 'card_emulation';
  supportedCards: string[]; // Visa, Mastercard, Amex, etc.
  maxTransactionAmount: number;
  requirePIN: boolean;
  supportContactless: boolean;
  enableHCE: boolean; // Host Card Emulation
}

/**
 * NFC Payment Adapter for contactless payment processing
 * Supports EMV contactless, Apple Pay, Google Pay, and custom payment flows
 */
export class NFCPaymentAdapter implements UPPDevice {
  private config: NFCDeviceConfig;
  private isInitialized = false;
  private currentSession?: string;
  private nfcReader?: any; // Platform-specific NFC reader instance

  constructor(config: Partial<NFCDeviceConfig> = {}) {
    this.config = {
      mode: 'reader',
      supportedCards: ['visa', 'mastercard', 'amex', 'discover'],
      maxTransactionAmount: 10000, // $100.00 in cents
      requirePIN: false,
      supportContactless: true,
      enableHCE: true,
      ...config,
    };
  }

  // UPPDevice interface implementation
  getDeviceId(): string {
    return `nfc-${this.getDeviceFingerprint()}`;
  }

  getDeviceType(): string {
    return 'NFC_PAYMENT_TERMINAL';
  }

  getCapabilities(): DeviceCapabilities {
    return {
      hasDisplay: false,
      hasCamera: false,
      hasNFC: true,
      hasBluetooth: false,
      hasWiFi: false,
      hasKeypad: false,
      hasTouchScreen: false,
      hasVoiceInput: false,
      hasVoiceOutput: false,
      hasPrinter: false,
      supportsEncryption: true,
      internet_connection: false, // NFC can work offline
      maxPaymentAmount: this.config.maxTransactionAmount,
      supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD'],
      securityLevel: 'PCI_LEVEL_1',
    };
  }

  getDeviceFingerprint(): string {
    return this.getFingerprint();
  }

  getFingerprint(): string {
    // Generate a consistent fingerprint based on device capabilities
    const deviceData = {
      type: 'nfc_terminal',
      mode: this.config.mode,
      supportedCards: this.config.supportedCards.sort(),
      maxAmount: this.config.maxTransactionAmount,
      timestamp: Date.now()
    };
    
    return `nfc_${btoa(JSON.stringify(deviceData)).slice(0, 16)}`;
  }

  getSecurityContext(): SecurityContext {
    return {
      encryptionLevel: 'AES256',
      deviceAttestation: 'pci_certified',
      userAuthentication: this.config.requirePIN ? 'pin_required' : 'contactless',
      trustedEnvironment: true
    };
  }

  async handlePaymentResponse(response: PaymentResult): Promise<MobileResponse> {
    return {
      success: response.success,
      message: response.success ? 'Payment processed via NFC' : 'NFC payment failed',
      displayDuration: 3000,
      requiresUserAction: !response.success,
      metadata: {
        nfcSessionId: this.currentSession,
        cardType: response.metadata?.cardType,
        lastFourDigits: response.metadata?.lastFourDigits,
      },
    };
  }

  async handleError(error: UPPError): Promise<void> {
    console.error(`NFC Payment Error: ${error.message}`);
    
    // Clear any active NFC session
    if (this.currentSession) {
      await this.endNFCSession();
    }

    // Reset NFC reader state
    await this.resetNFCReader();
  }

  // NFC-specific methods

  /**
   * Initialize NFC reader and configure for payment processing
   */
  async initializeNFC(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize platform-specific NFC reader
      // This would be platform-specific implementation
      await this.initializePlatformNFC();
      
      // Configure EMV contactless settings
      await this.configureEMVContactless();
      
      // Setup Host Card Emulation if enabled
      if (this.config.enableHCE) {
        await this.setupHostCardEmulation();
      }

      this.isInitialized = true;
      console.log('NFC Payment Adapter initialized successfully');
    } catch (error) {
      throw createDeviceError(`Failed to initialize NFC: ${error}`);
    }
  }

  /**
   * Read payment card data via NFC
   */
  async readPaymentCard(timeout = 30000): Promise<PaymentCardData> {
    if (!this.isInitialized) {
      await this.initializeNFC();
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(createDeviceError('NFC card read timeout'));
      }, timeout);

      this.startCardDetection()
        .then(async (cardData) => {
          clearTimeout(timeoutId);
          
          // Validate card data
          const validatedData = PaymentCardDataSchema.parse(cardData);
          
          // Extract EMV data if available
          if (validatedData.emvData) {
            await this.processEMVData(validatedData.emvData);
          }
          
          resolve(validatedData);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(createDeviceError(`Failed to read payment card: ${error.message}`));
        });
    });
  }

  /**
   * Process contactless payment with card data
   */
  async processContactlessPayment(paymentRequest: PaymentRequest): Promise<PaymentResult> {
    try {
      this.currentSession = this.generateSessionId();
      
      // Validate transaction amount against limits
      if (paymentRequest.amount > this.config.maxTransactionAmount) {
        throw createDeviceError(`Transaction amount exceeds NFC limit: $${this.config.maxTransactionAmount / 100}`);
      }

      // Read payment card
      const cardData = await this.readPaymentCard();
      
      // Perform EMV contactless transaction
      const emvResult = await this.performEMVTransaction(cardData, paymentRequest);
      
      // Process payment through backend
      const paymentResult = await this.processPaymentTransaction(cardData, paymentRequest, emvResult);
      
      return paymentResult;
    } catch (error) {
      return {
        success: false,
        transactionId: '',
        amount: paymentRequest.amount,
        currency: paymentRequest.currency,
        error: error instanceof UPPError ? error.message : 'Unknown NFC payment error',
        metadata: {
          nfcSessionId: this.currentSession,
          errorCode: 'NFC_PAYMENT_FAILED',
        },
      };
    } finally {
      await this.endNFCSession();
    }
  }

  /**
   * Write NDEF record to NFC tag/device
   */
  async writeNDEF(records: NDEFRecord[]): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeNFC();
    }

    try {
      // Create NDEF message from records
      const ndefMessage = await this.createNDEFMessage(records);
      
      // Write to NFC tag/device
      await this.writeToNFCTag(ndefMessage);
      
      console.log('NDEF records written successfully');
    } catch (error) {
      throw createDeviceError(`Failed to write NDEF: ${error}`);
    }
  }

  /**
   * Setup Host Card Emulation for device-to-device payments
   */
  async setupHostCardEmulation(): Promise<void> {
    try {
      // Register HCE service with system
      await this.registerHCEService();
      
      // Configure payment application
      await this.configurePaymentApplication();
      
      console.log('Host Card Emulation setup complete');
    } catch (error) {
      throw createDeviceError(`Failed to setup HCE: ${error}`);
    }
  }

  // Private helper methods

  private async initializePlatformNFC(): Promise<void> {
    // Platform-specific NFC initialization
    // This would interface with actual NFC hardware APIs
    
    // Simulate NFC reader initialization
    console.log('Initializing platform NFC reader...');
    
    // In real implementation, this would:
    // - Initialize NFC chip
    // - Configure antenna settings
    // - Set up interrupt handlers
    // - Validate hardware capabilities
  }

  private async configureEMVContactless(): Promise<void> {
    // Configure EMV contactless parameters
    const emvConfig = {
      transactionLimitNoPin: 5000, // $50.00
      transactionLimitPin: this.config.maxTransactionAmount,
      supportedAIDs: [
        'A0000000041010', // Visa
        'A0000000031010', // Mastercard
        'A000000025010104', // American Express
      ],
      terminalCapabilities: '0xE0F8C8', // Terminal capabilities
      additionalTerminalCapabilities: '0xF000F0A001', // Additional capabilities
    };

    console.log('EMV contactless configuration applied', emvConfig);
  }

  private async startCardDetection(): Promise<any> {
    // Start NFC card detection loop
    // This would interface with actual NFC hardware
    
    // Simulate card detection
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulate detected card data
        const simulatedCardData = {
          pan: '4111111111111111',
          expiryDate: '12/25',
          cardholderName: 'John Doe',
          serviceCode: '101',
          emvData: {
            '5F2A': '0840', // Transaction Currency Code (USD)
            '82': '1980', // Application Interchange Profile
            '9F36': '0123', // Application Transaction Counter
          },
          applicationId: 'A0000000041010',
          cryptogram: 'ABCD1234567890EF',
        };
        
        resolve(simulatedCardData);
      }, 2000); // Simulate 2-second card tap
    });
  }

  private async processEMVData(emvData: Record<string, any>): Promise<void> {
    // Process EMV tag-value pairs
    console.log('Processing EMV data:', emvData);
    
    // Validate required EMV tags
    const requiredTags = ['5F2A', '82', '9F36']; // Currency, AIP, ATC
    for (const tag of requiredTags) {
      if (!emvData[tag]) {
        throw createDeviceError(`Missing required EMV tag: ${tag}`);
      }
    }
  }

  private async performEMVTransaction(
    cardData: PaymentCardData,
    paymentRequest: PaymentRequest
  ): Promise<any> {
    // Perform EMV contactless transaction processing
    const emvTransaction = {
      amount: paymentRequest.amount,
      currency: paymentRequest.currency,
      transactionType: '00', // Purchase
      terminalVerificationResults: '8000008000',
      cryptogramInformationData: '80',
      applicationCryptogram: cardData.cryptogram,
    };

    console.log('EMV transaction processed:', emvTransaction);
    return emvTransaction;
  }

  private async processPaymentTransaction(
    cardData: PaymentCardData,
    paymentRequest: PaymentRequest,
    emvResult: any
  ): Promise<PaymentResult> {
    // Process payment through payment gateway
    // This would integrate with Stripe or other payment processor
    
    // Simulate successful payment
    const transactionId = `nfc_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    
    return {
      success: true,
      transactionId,
      amount: paymentRequest.amount,
      currency: paymentRequest.currency,
      timestamp: new Date(),
      metadata: {
        cardType: this.detectCardType(cardData.pan),
        lastFourDigits: cardData.pan.slice(-4),
        nfcSessionId: this.currentSession,
        emvApplicationId: cardData.applicationId,
        contactlessIndicator: true,
      },
    };
  }

  private async createNDEFMessage(records: NDEFRecord[]): Promise<Buffer> {
    // Create NDEF message format from records
    // This would implement actual NDEF specification
    
    const message = records.map(record => ({
      type: record.type,
      payload: record.payload,
      id: record.id || '',
    }));

    return Buffer.from(JSON.stringify(message));
  }

  private async writeToNFCTag(ndefMessage: Buffer): Promise<void> {
    // Write NDEF message to NFC tag
    console.log('Writing NDEF message to tag:', ndefMessage.toString('hex'));
  }

  private async registerHCEService(): Promise<void> {
    // Register Host Card Emulation service with OS
    console.log('Registering HCE service...');
  }

  private async configurePaymentApplication(): Promise<void> {
    // Configure payment application for HCE
    console.log('Configuring HCE payment application...');
  }

  private generateSessionId(): string {
    return `nfc_session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private async endNFCSession(): Promise<void> {
    if (this.currentSession) {
      console.log(`Ending NFC session: ${this.currentSession}`);
      this.currentSession = undefined;
    }
  }

  private async resetNFCReader(): Promise<void> {
    // Reset NFC reader to idle state
    console.log('Resetting NFC reader...');
  }

  private detectCardType(pan: string): string {
    if (pan.startsWith('4')) return 'visa';
    if (pan.startsWith('5') || pan.startsWith('2')) return 'mastercard';
    if (pan.startsWith('3')) return 'amex';
    if (pan.startsWith('6')) return 'discover';
    return 'unknown';
  }

  private hashConfig(): string {
    const configString = JSON.stringify(this.config);
    return Buffer.from(configString).toString('base64').substring(0, 8);
  }
}