export class IoTDeviceAdapter {
  deviceType = 'iot_device';
  fingerprint: string;
  capabilities = {
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
    maxPaymentAmount: 5000, // $50.00 in cents
    supportedCurrencies: ['USD'],
    securityLevel: 'STANDARD' as const
  };
  securityContext = {
    encryptionLevel: 'AES256',
    deviceAttestation: 'trusted'
  };

  constructor(private info: any) {
    this.fingerprint = `iot_${Date.now()}`;
  }

  // Required UPPDevice methods
  getDeviceId(): string {
    return this.fingerprint;
  }

  getDeviceType(): string {
    return this.deviceType;
  }

  getCapabilities() {
    return this.capabilities;
  }

  getDeviceFingerprint(): string {
    return this.fingerprint;
  }

  getFingerprint(): string {
    return this.fingerprint;
  }

  getSecurityContext() {
    return this.securityContext;
  }

  async handlePaymentResponse(response: any) {
    console.log('🏠 IoT device LED flashing green - payment confirmed');
    return {
      success: response.success,
      deviceCount: 1,
      status: response.success ? 'payment_confirmed' : 'payment_failed',
      ledPattern: response.success ? 'green_blink' : 'red_flash'
    };
  }

  async handleError(error: any) {
    console.log('🏠 IoT device LED flashing red - payment failed');
  }
}