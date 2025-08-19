/**
 * Real-World Device Integration Demo
 * Demonstrates all the new device adapters for actual hardware communication
 */

import {
  NFCPaymentAdapter,
  BLEDeviceAdapter,
  WebRTCAdapter,
  SmartTVAdapter,
  IoTDeviceAdapter,
  VoiceAssistantAdapter,
  GamingControllerAdapter,
  IoTDeviceType,
  SmartTVPlatform,
  VoiceAssistantPlatform,
  GamingPlatform,
  GamePurchaseType,
} from '../modules/universal-payment-protocol/devices/index.js';

/**
 * Comprehensive demo of real-world device payment integrations
 */
export class RealWorldDeviceDemo {
  private devices: any[] = [];

  async runComprehensiveDemo(): Promise<void> {
    console.log('🚀 Universal Payment Protocol - Real-World Device Integration Demo');
    console.log('================================================================\n');

    try {
      // 1. NFC Payment Terminal
      await this.demonstrateNFC();
      
      // 2. BLE IoT Ecosystem  
      await this.demonstrateBLE();
      
      // 3. WebRTC Peer-to-Peer Payments
      await this.demonstrateWebRTC();
      
      // 4. Smart TV Large Screen Experience
      await this.demonstrateSmartTV();
      
      // 5. IoT Automated Purchasing
      await this.demonstrateIoT();
      
      // 6. Voice Assistant Integration
      await this.demonstrateVoiceAssistant();
      
      // 7. Gaming Console In-Game Purchases
      await this.demonstrateGaming();

      console.log('\n✅ All real-world device integrations demonstrated successfully!');
      console.log('🌍 UPP now supports ANY internet-connected device as a payment terminal');
      
    } catch (error) {
      console.error('❌ Demo failed:', error);
    }
  }

  private async demonstrateNFC(): Promise<void> {
    console.log('📱 NFC Payment Terminal Demo');
    console.log('----------------------------');

    const nfcAdapter = new NFCPaymentAdapter({
      mode: 'reader',
      supportedCards: ['visa', 'mastercard', 'amex'],
      maxTransactionAmount: 10000, // $100.00
      requirePIN: false,
      supportContactless: true,
      enableHCE: true,
    });

    await nfcAdapter.initializeNFC();

    console.log(`Device ID: ${nfcAdapter.getDeviceId()}`);
    console.log(`Type: ${nfcAdapter.getDeviceType()}`);
    console.log('Capabilities:', nfcAdapter.getCapabilities());

    // Simulate contactless payment
    const paymentRequest = {
      amount: 2500, // $25.00
      currency: 'USD',
      description: 'Coffee Shop Purchase',
      merchantId: 'coffee-shop-123',
    };

    console.log('💳 Processing contactless payment...');
    const result = await nfcAdapter.processContactlessPayment(paymentRequest);
    console.log('Result:', result.success ? '✅ Payment Successful' : '❌ Payment Failed');
    console.log('Transaction ID:', result.transactionId);
    console.log('Amount:', `$${(result.amount / 100).toFixed(2)} ${result.currency}\n`);
  }

  private async demonstrateBLE(): Promise<void> {
    console.log('📡 BLE IoT Device Network Demo');
    console.log('------------------------------');

    const bleAdapter = new BLEDeviceAdapter({
      scanTimeout: 10000,
      maxConcurrentConnections: 5,
      enableEncryption: true,
      deviceFilters: {
        namePrefix: 'UPP-',
        serviceUuids: ['6E400001-B5A3-F393-E0A9-E50E24DCCA9E'],
      },
    });

    await bleAdapter.initializeBLE();

    console.log(`Device ID: ${bleAdapter.getDeviceId()}`);
    console.log('🔍 Scanning for BLE devices...');
    
    const discoveredDevices = await bleAdapter.scanForDevices();
    console.log(`Found ${discoveredDevices.length} UPP-enabled BLE devices:`);
    
    for (const device of discoveredDevices) {
      console.log(`  - ${device.name} (${device.id}) - Signal: ${device.rssi}dBm`);
      
      if (device.batteryLevel) {
        console.log(`    Battery: ${device.batteryLevel}%`);
      }
    }

    if (discoveredDevices.length > 0) {
      const targetDevice = discoveredDevices[0];
      await bleAdapter.connectToDevice(targetDevice.id);
      
      const paymentRequest = {
        amount: 599, // $5.99
        currency: 'USD',
        description: 'IoT Sensor Data Purchase',
      };

      console.log('💸 Sending payment request to BLE device...');
      const result = await bleAdapter.sendPaymentRequest(targetDevice.id, paymentRequest);
      console.log('Result:', result.success ? '✅ Payment Successful' : '❌ Payment Failed');
      console.log('Device Battery:', `${result.metadata?.deviceBattery}%\n`);
    }
  }

  private async demonstrateWebRTC(): Promise<void> {
    console.log('🌐 WebRTC Peer-to-Peer Payment Demo');
    console.log('-----------------------------------');

    const webrtcAdapter = new WebRTCAdapter({
      signalingServerUrl: 'wss://signaling.upp-protocol.com',
      enableDataChannel: true,
      enableVideoStream: true,
      enableScreenShare: true,
      maxPeers: 10,
    });

    await webrtcAdapter.initializeWebRTC();

    console.log(`Device ID: ${webrtcAdapter.getDeviceId()}`);
    console.log('🔗 Setting up peer connections...');

    // Simulate peer connection
    const peerId = 'peer-device-001';
    await webrtcAdapter.createPeerConnection(peerId);

    console.log('👥 Connected peers:', webrtcAdapter.getConnectedPeers());

    if (webrtcAdapter.getConnectedPeers().includes(peerId)) {
      const paymentRequest = {
        amount: 1299, // $12.99
        currency: 'USD',
        description: 'P2P Direct Payment',
      };

      console.log('💱 Sending peer-to-peer payment...');
      const result = await webrtcAdapter.sendPaymentRequestP2P(peerId, paymentRequest);
      console.log('Result:', result.success ? '✅ Payment Successful' : '❌ Payment Failed');
      
      // Demonstrate screen sharing for payment verification
      console.log('📺 Starting screen share for payment verification...');
      const screenStream = await webrtcAdapter.startScreenShare();
      console.log('Screen sharing active for payment verification');
      
      setTimeout(async () => {
        await webrtcAdapter.stopScreenShare();
        console.log('Screen sharing stopped\n');
      }, 2000);
    }
  }

  private async demonstrateSmartTV(): Promise<void> {
    console.log('📺 Smart TV Payment Experience Demo');
    console.log('-----------------------------------');

    const tvAdapter = new SmartTVAdapter({
      platform: SmartTVPlatform.SAMSUNG_TIZEN,
      displayResolution: {
        width: 3840,
        height: 2160,
        aspectRatio: '16:9',
        refreshRate: 120,
        hdr: true,
      },
      hasRemoteControl: true,
      hasVoiceControl: true,
      supportsCasting: true,
      deviceModel: 'Samsung QN85B 85"',
    });

    await tvAdapter.initializeTV();

    console.log(`Device ID: ${tvAdapter.getDeviceId()}`);
    console.log(`Display: ${tvAdapter.getCapabilities()}`);

    const paymentRequest = {
      amount: 1999, // $19.99
      currency: 'USD',
      description: '4K Movie Rental',
      merchantId: 'streaming-service',
    };

    console.log('🎬 Displaying QR code payment on 85" 4K TV...');
    await tvAdapter.displayQRCode(paymentRequest);

    // Simulate successful payment
    const mockResult = {
      success: true,
      transactionId: 'tv_payment_' + Date.now(),
      amount: paymentRequest.amount,
      currency: paymentRequest.currency,
      timestamp: new Date(),
      metadata: { platform: 'smart_tv' },
    };

    console.log('🎉 Showing full-screen payment confirmation...');
    await tvAdapter.showPaymentConfirmation(mockResult);
    console.log('Payment displayed on TV with surround sound confirmation\n');
  }

  private async demonstrateIoT(): Promise<void> {
    console.log('🏠 IoT Automated Purchasing Demo');
    console.log('--------------------------------');

    const iotAdapter = new IoTDeviceAdapter({
      deviceType: IoTDeviceType.SMART_FRIDGE,
      protocol: 'mqtt' as any,
      networkConfig: {
        brokerUrl: 'mqtt://iot.upp-protocol.com',
        clientId: 'smart-fridge-001',
        qosLevel: 1,
      },
      sensors: [
        {
          id: 'level_sensor_milk',
          type: 'level',
          interval: 60000, // Check every minute
        },
        {
          id: 'temp_sensor',
          type: 'temperature',
          interval: 30000, // Check every 30 seconds
        },
      ],
      automaticOrdering: {
        enabled: true,
        thresholds: {
          'milk': 20, // Reorder when milk level < 20%
          'eggs': 2,  // Reorder when < 2 eggs
        },
        suppliers: {
          'milk': 'grocery-supplier-001',
          'eggs': 'grocery-supplier-001',
        },
      },
    });

    await iotAdapter.initializeIoT();

    console.log(`Device ID: ${iotAdapter.getDeviceId()}`);
    console.log('📊 Reading sensor data...');
    
    const sensorData = await iotAdapter.readSensorData();
    for (const reading of sensorData) {
      console.log(`  ${reading.sensorId}: ${reading.value}${reading.unit} (${reading.type})`);
    }

    // Simulate low inventory triggering automatic order
    console.log('📦 Milk level low - triggering automatic order...');
    const automaticOrder = await iotAdapter.triggerAutomaticOrder('milk', 2);
    
    console.log('🛒 Automatic order created:');
    console.log(`  Amount: $${(automaticOrder.amount / 100).toFixed(2)}`);
    console.log(`  Items: ${automaticOrder.metadata?.quantity}x ${automaticOrder.metadata?.itemId}`);
    console.log(`  Supplier: ${automaticOrder.merchantId}\n`);
  }

  private async demonstrateVoiceAssistant(): Promise<void> {
    console.log('🎙️ Voice Assistant Payment Demo');
    console.log('-------------------------------');

    const voiceAdapter = new VoiceAssistantAdapter({
      platform: VoiceAssistantPlatform.AMAZON_ALEXA,
      speechToText: {
        provider: 'amazon',
        language: 'en-US',
        model: 'latest_long',
        profanityFilter: true,
        wordTimeOffsets: false,
        speakerDiarization: false
      },
      voiceAuthentication: {
        enabled: true,
        enrollmentRequired: true,
        confidenceThreshold: 0.85,
        maxAttempts: 3,
      },
      paymentSettings: {
        requireVoiceAuth: true,
        maxPaymentAmount: 5000, // $50.00
        confirmationRequired: true,
        allowedMerchants: ['Amazon', 'Walmart', 'Target']
      },
    });

    await voiceAdapter.initializeVoiceAssistant();

    console.log(`Device ID: ${voiceAdapter.getDeviceId()}`);
    console.log('🎯 Processing voice command: "Pay twenty dollars to coffee shop"');

    // Simulate voice command processing
    const audioBuffer = new ArrayBuffer(1024); // Mock audio data
    const response = await voiceAdapter.processVoiceCommand(audioBuffer);

    if ('amount' in response) {
      // It's a payment request
      console.log('💬 Voice payment request processed:');
      console.log(`  Amount: $${(response.amount / 100).toFixed(2)}`);
      console.log(`  Merchant: ${response.merchantId}`);
    } else {
      // It's a voice response
      console.log('🗣️ Assistant Response:', response.message);
      console.log('📱 Should end session:', response.shouldEndSession ? 'Yes' : 'No');
    }

    console.log('🔊 Playing audio confirmation...\n');
  }

  private async demonstrateGaming(): Promise<void> {
    console.log('🎮 Gaming Console In-Game Purchase Demo');
    console.log('---------------------------------------');

    const gamingAdapter = new GamingControllerAdapter({
      platform: GamingPlatform.PLAYSTATION_5,
      features: {
        hasHapticFeedback: true,
        hasAdaptiveTriggers: true,
        hasTouchpad: true,
        hasGyroscope: true,
        hasAccelerometer: true,
        hasLightBar: true,
        hasSpeaker: true,
        hasMicrophone: true
      },
      paymentSettings: {
        requireSequenceAuth: true,
        secretSequence: {
          inputs: ['circle', 'circle', 'square', 'triangle'],
          timing: [500, 500, 500, 500],
          holdDuration: [100, 100, 100, 100]
        },
        maxPurchaseAmount: 9999, // $99.99
        parentalControls: false,
        spendingLimit: {
          daily: 5000,   // $50.00
          weekly: 20000, // $200.00
          monthly: 50000, // $500.00
        }
      },
      gameIntegration: {
        gameTitle: 'Cyber Warriors 2077',
        developerId: 'epic-games',
        supportedPurchaseTypes: [
          GamePurchaseType.DLC,
          GamePurchaseType.COSMETIC,
          GamePurchaseType.CURRENCY,
        ],
        overlayEnabled: true,
        achievementIntegration: true
      },
    });

    await gamingAdapter.initializeController();

    console.log(`Device ID: ${gamingAdapter.getDeviceId()}`);
    console.log('🕹️ Setting up gaming payment overlay...');

    const gamePurchase = {
      purchaseType: GamePurchaseType.COSMETIC,
      gameId: 'cyber-warriors-2077',
      itemId: 'legendary-armor-set',
      itemName: 'Legendary Cyber Armor Set',
      rarity: 'legendary' as const,
      quantity: 1,
      price: 2499, // $24.99
      currency: 'USD',
      previewAvailable: true,
    };

    console.log('🎨 Processing in-game purchase...');
    console.log(`  Item: ${gamePurchase.itemName} (${gamePurchase.rarity})`);
    console.log(`  Price: $${(gamePurchase.price / 100).toFixed(2)}`);

    const result = await gamingAdapter.processInGamePurchase(gamePurchase);
    console.log('Result:', result.success ? '✅ Purchase Successful' : '❌ Purchase Failed');
    
    if (result.success) {
      console.log('🎊 Achievement unlocked: First Purchase');
      console.log('💰 Bonus currency awarded: 25 coins');
      console.log('🎛️ Controller haptic feedback: Success pulse');
      console.log('💡 Light bar: Green success pattern');
    }

    console.log('');
  }
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const demo = new RealWorldDeviceDemo();
  demo.runComprehensiveDemo().catch(console.error);
}