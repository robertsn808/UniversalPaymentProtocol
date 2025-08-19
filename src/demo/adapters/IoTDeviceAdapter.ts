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
    encryption_level: 'AES256',
    device_attestation: 'trusted'
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
  }

  async handleError(error: any) {
    console.log('🏠 IoT device LED flashing red - payment failed');
  }
}