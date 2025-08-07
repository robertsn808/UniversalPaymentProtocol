// 🌊 DEMO VISUAL EFFECTS - QR Codes, NFC Animations & More!
// Making the demo come ALIVE with realistic payment visuals! ⚡

import * as QRCode from 'qrcode';

export interface QRCodeData {
  paymentId: string;
  amount: number;
  merchantId: string;
  deviceId: string;
  timestamp: string;
}

export interface NFCSimulation {
  deviceId: string;
  status: 'waiting' | 'detected' | 'processing' | 'completed' | 'error';
  animation: 'pulse' | 'scan' | 'success' | 'fail';
  cardData?: {
    type: string;
    last4: string;
    brand: string;
  };
}

export class DemoVisualEffects {
  private qrCodeCache: Map<string, string> = new Map();
  private nfcAnimations: Map<string, NFCSimulation> = new Map();

  // 📱 Generate QR code for Smart TV payments
  async generatePaymentQR(paymentData: QRCodeData): Promise<string> {
    const cacheKey = `${paymentData.paymentId}_${paymentData.amount}`;
    
    if (this.qrCodeCache.has(cacheKey)) {
      return this.qrCodeCache.get(cacheKey)!;
    }

    // Create realistic payment URL with UPP protocol
    const paymentUrl = `upp://pay?` + new URLSearchParams({
      id: paymentData.paymentId,
      amount: paymentData.amount.toString(),
      merchant: paymentData.merchantId,
      device: paymentData.deviceId,
      timestamp: paymentData.timestamp,
      currency: 'USD',
      protocol_version: '1.0'
    }).toString();

    try {
      // Generate high-quality QR code
      const qrCodeDataURL = await QRCode.toDataURL(paymentUrl, {
        errorCorrectionLevel: 'M',
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 256
      });

      this.qrCodeCache.set(cacheKey, qrCodeDataURL);
      console.log(`🌊 QR Code generated for payment ${paymentData.paymentId}: $${paymentData.amount}`);
      
      return qrCodeDataURL;
    } catch (error) {
      console.error('❌ QR Code generation failed:', error);
      return this.generateFallbackQR(paymentData);
    }
  }

  // 📱 NFC Simulation for Smartphone payments
  simulateNFC(deviceId: string): NFCSimulation {
    const simulation: NFCSimulation = {
      deviceId,
      status: 'waiting',
      animation: 'pulse',
      cardData: this.generateMockCardData()
    };

    this.nfcAnimations.set(deviceId, simulation);
    console.log(`🌊 NFC simulation started for device ${deviceId}`);

    // Simulate NFC detection sequence
    void this.runNFCSequence(deviceId);

    return simulation;
  }

  private runNFCSequence(deviceId: string): void {
    const simulation = this.nfcAnimations.get(deviceId);
    if (!simulation) return;

    // Step 1: Waiting for card (2 seconds)
    setTimeout(() => {
      simulation.status = 'detected';
      simulation.animation = 'scan';
      console.log(`📱 NFC card detected on ${deviceId}`);
    }, 2000);

    // Step 2: Processing (1.5 seconds)
    setTimeout(() => {
      simulation.status = 'processing';
      simulation.animation = 'scan';
      console.log(`🔄 NFC processing payment on ${deviceId}`);
    }, 3500);

    // Step 3: Completion (95% success rate)
    setTimeout(() => {
      const success = Math.random() > 0.05;
      simulation.status = success ? 'completed' : 'error';
      simulation.animation = success ? 'success' : 'fail';
      
      const statusIcon = success ? '✅' : '❌';
      console.log(`${statusIcon} NFC payment ${success ? 'completed' : 'failed'} on ${deviceId}`);
    }, 5000);

    // Step 4: Reset after display time
    setTimeout(() => {
      this.nfcAnimations.delete(deviceId);
    }, 8000);
  }

  private generateMockCardData(): { type: string; last4: string; brand: string } {
    const cardTypes = ['credit', 'debit', 'mobile_wallet'];
    const cardBrands = ['Visa', 'Mastercard', 'American Express', 'Apple Pay', 'Google Pay'];
    
    return {
      type: cardTypes[Math.floor(Math.random() * cardTypes.length)] || 'credit',
      last4: Math.floor(1000 + Math.random() * 9000).toString(),
      brand: cardBrands[Math.floor(Math.random() * cardBrands.length)] || 'Visa'
    };
  }

  private generateFallbackQR(paymentData: QRCodeData): string {
    // Simple fallback QR code as SVG data URL
    // Generate QR text for payment data
    const svg = `
      <svg width="256" height="256" xmlns="http://www.w3.org/2000/svg">
        <rect width="256" height="256" fill="white"/>
        <rect x="32" y="32" width="192" height="192" fill="none" stroke="black" stroke-width="2"/>
        <text x="128" y="100" text-anchor="middle" font-family="monospace" font-size="12">UPP Payment</text>
        <text x="128" y="130" text-anchor="middle" font-family="monospace" font-size="16" font-weight="bold">$${paymentData.amount}</text>
        <text x="128" y="160" text-anchor="middle" font-family="monospace" font-size="10">${paymentData.paymentId.substring(0, 16)}...</text>
        <text x="128" y="180" text-anchor="middle" font-family="monospace" font-size="8">Scan with UPP App</text>
      </svg>
    `;
    
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  }

  // 🎮 Gaming Console Controller Animation
  generateControllerSequence(deviceId: string): string[] {
    const sequences = [
      ['←', '→', 'A', 'B'],        // Navigate to store
      ['↑', '↓', 'SELECT'],        // Choose item
      ['START', 'A', 'A'],         // Confirm purchase
      ['Y', 'X', 'MENU']           // Payment method
    ];
    
    const sequence = sequences[Math.floor(Math.random() * sequences.length)];
    if (sequence) {
      console.log(`🎮 Controller sequence for ${deviceId}: ${sequence.join(' → ')}`);
      return sequence;
    }
    
    return ['A', 'B', 'START']; // Fallback sequence
  }

  // 🎙️ Voice Assistant Command Recognition
  generateVoiceCommands(deviceId: string): string[] {
    const commands = [
      "Hey UPP, buy premium music subscription",
      "Purchase my usual coffee order", 
      "Order groceries from my shopping list",
      "Pay for Netflix premium plan",
      "Buy the new game DLC"
    ];
    
    const selectedCommand = commands[Math.floor(Math.random() * commands.length)];
    if (selectedCommand) {
      console.log(`🎙️ Voice command for ${deviceId}: "${selectedCommand}"`);
      return [selectedCommand, "Payment confirmed!", "Thank you for using UPP!"];
    }
    
    return ["Hey UPP, buy premium music subscription", "Payment confirmed!", "Thank you for using UPP!"];
  }

  // 🏠 IoT Device Status LED Pattern
  generateIoTLEDPattern(deviceId: string, status: 'idle' | 'processing' | 'success' | 'error'): string[] {
    const patterns = {
      'idle': ['🔵', '⚫', '🔵', '⚫'],           // Slow blue pulse
      'processing': ['🟡', '🟠', '🟡', '🟠'],   // Yellow/orange alternating
      'success': ['🟢', '🟢', '🟢', '⚫'],      // Triple green flash
      'error': ['🔴', '⚫', '🔴', '⚫']          // Red blinking
    };
    
    console.log(`🏠 IoT LED pattern for ${deviceId}: ${patterns[status].join(' ')}`);
    return patterns[status];
  }

  // 📺 Smart TV Display Animation
  async generateTVDisplayData(paymentData: QRCodeData): Promise<{ mainDisplay: { title: string; amount: string; instruction: string; timeRemaining: number }; qrCode: string; footerInfo: { deviceInfo: string; networkStatus: string; version: string } }> {
    return {
      mainDisplay: {
        title: "🌊 UPP Payment Ready",
        amount: `$${paymentData.amount}`,
        instruction: "Scan QR code with your phone",
        timeRemaining: 300 // 5 minutes
      },
      qrCode: await this.generatePaymentQR(paymentData),
      footerInfo: {
        deviceInfo: paymentData.merchantId,
        networkStatus: paymentData.paymentId.substring(0, 8) + '...',
        version: "🔒 Secure UPP Transaction"
      },
      // animations: {
      //   scanLine: true,
      //   pulseEffect: true,
      //   countdownTimer: true
      // }
    };
  }

  // 🌊 Get current NFC simulation status
  getNFCStatus(deviceId: string): NFCSimulation | null {
    return this.nfcAnimations.get(deviceId) ?? null;
  }

  // 🌊 Get cached QR code
  getCachedQR(paymentId: string, amount: number): string | null {
    const cacheKey = `${paymentId}_${amount}`;
    return this.qrCodeCache.get(cacheKey) ?? null;
  }

  // 🔄 Clear visual effect caches
  clearCaches(): void {
    this.qrCodeCache.clear();
    this.nfcAnimations.clear();
    console.log('🔄 Visual effects caches cleared');
  }

  // 📊 Get visual effects statistics
  getEffectsStats(): { qrCodesGenerated: number; activeNFCSimulations: number; cacheMemoryUsage: string } {
    return {
      qrCodesGenerated: this.qrCodeCache.size,
      activeNFCSimulations: this.nfcAnimations.size,
      cacheMemoryUsage: this.estimateCacheSize()
    };
  }

  private estimateCacheSize(): string {
    const qrCodeSize = this.qrCodeCache.size * 1024; // Rough estimate
    const nfcSize = this.nfcAnimations.size * 256;
    const totalBytes = qrCodeSize + nfcSize;
    
    if (totalBytes > 1024 * 1024) {
      return `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`;
    } else if (totalBytes > 1024) {
      return `${(totalBytes / 1024).toFixed(2)} KB`;
    } else {
      return `${totalBytes} bytes`;
    }
  }
}

// 🌊 Export singleton for demo use
export const demoVisualEffects = new DemoVisualEffects();

// Demo startup message
console.log('🌊 Demo Visual Effects system loaded - Ready to create magic!');