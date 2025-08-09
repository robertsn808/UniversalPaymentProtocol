// 🌊 DEMO VISUAL EFFECTS - QR Codes, NFC Animations & More!
// Making the demo come ALIVE with realistic payment visuals! ⚡

// Note: The original QRCodeData interface is duplicated in the edited snippet.
// I will use the one from the edited snippet as it's part of the new class definition.

export interface QRCodeData {
  paymentId: string;
  amount: number;
  merchantId: string;
  deviceId: string;
  timestamp: string;
}

export class DemoVisualEffects {
  private nfcAnimations = new Map<string, boolean>();
  private qrCodes = new Map<string, string>();

  simulateNFC(deviceId: string): void {
    console.log(`📱 Simulating NFC tap on ${deviceId}...`);
    this.nfcAnimations.set(deviceId, true);

    // Simulate NFC interaction duration
    setTimeout(() => {
      this.nfcAnimations.delete(deviceId);
      console.log(`✅ NFC interaction completed for ${deviceId}`);
    }, 2000);
  }

  async generatePaymentQR(data: QRCodeData): Promise<string> {
    const qrString = JSON.stringify(data);
    const qrCode = `QR_${Date.now()}_${Math.random().toString(36).substring(2)}`;

    this.qrCodes.set(data.paymentId, qrCode);
    console.log(`📱 QR Code generated for payment ${data.paymentId}`);

    return qrCode;
  }

  isNFCActive(deviceId: string): boolean {
    return this.nfcAnimations.has(deviceId);
  }

  getQRCode(paymentId: string): string | undefined {
    return this.qrCodes.get(paymentId);
  }

  clearEffects(): void {
    this.nfcAnimations.clear();
    this.qrCodes.clear();
  }
}

// 🌊 Export singleton for demo use
export const demoVisualEffects = new DemoVisualEffects();

// Demo startup message
console.log('🌊 Demo Visual Effects system loaded - Ready to create magic!');