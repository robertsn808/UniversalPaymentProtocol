// 🌊 THE ULTIMATE UPP DEMO - THE FUTURE OF PAYMENTS! 
// This will blow minds and change the world! 💰⚡

import { EventEmitter } from 'events';

export interface DemoDevice {
  id: string;
  type: 'smartphone' | 'smart_tv' | 'iot_device' | 'gaming_console' | 'voice_assistant';
  name: string;
  status: 'idle' | 'processing' | 'completed' | 'error';
  capabilities: DeviceCapabilities;
  lastPayment?: DemoPayment;
  totalProcessed: number;
}

export interface DemoPayment {
  id: string;
  deviceId: string;
  deviceType: string;
  amount: number;
  currency: string;
  description: string;
  timestamp: Date;
  status: 'processing' | 'completed' | 'failed';
  method: 'nfc' | 'qr_code' | 'voice' | 'controller' | 'automated';
  customerName?: string;
}

export interface DeviceCapabilities {
  payment_methods: string[];
  display_type: 'mobile' | 'large' | 'minimal' | 'gaming' | 'voice_only';
  input_methods: string[];
  special_features?: string[];
}

export class UltimateUPPDemo extends EventEmitter {
  private devices: Map<string, DemoDevice> = new Map();
  private activePayments: Map<string, DemoPayment> = new Map();
  private totalRevenue: number = 0;
  private sessionStats = {
    paymentsProcessed: 0,
    devicesUsed: new Set<string>(),
    startTime: new Date(),
    avgPaymentTime: 0
  };

  constructor() {
    super();
    this.initializeDemoDevices();
    console.log('🌊 ULTIMATE UPP DEMO INITIALIZED - Ready to blow minds!');
  }

  private initializeDemoDevices() {
    // 📱 Smartphone Payment Station
    this.addDevice({
      id: 'smartphone_demo_01',
      type: 'smartphone',
      name: '🌊 UPP Smartphone (NFC Ready)',
      status: 'idle',
      capabilities: {
        payment_methods: ['nfc', 'qr_scan', 'biometric'],
        display_type: 'mobile',
        input_methods: ['touch', 'voice', 'biometric'],
        special_features: ['nfc_tap_to_pay', 'apple_pay_ready', 'face_id']
      },
      totalProcessed: 0
    });

    // 📺 Smart TV Payment Wall
    this.addDevice({
      id: 'smart_tv_demo_01',
      type: 'smart_tv',
      name: '🌊 UPP Smart TV (65" 4K)',
      status: 'idle',
      capabilities: {
        payment_methods: ['qr_display', 'remote_control', 'voice'],
        display_type: 'large',
        input_methods: ['remote', 'voice', 'mobile_app'],
        special_features: ['qr_generator', 'voice_recognition', '4k_display']
      },
      totalProcessed: 0
    });

    // 🎮 Gaming Console Hub
    this.addDevice({
      id: 'gaming_console_01',
      type: 'gaming_console',
      name: '🌊 UPP Gaming Console (Ultimate Edition)',
      status: 'idle',
      capabilities: {
        payment_methods: ['controller', 'voice', 'mobile_link'],
        display_type: 'gaming',
        input_methods: ['controller', 'voice', 'motion'],
        special_features: ['in_game_purchases', 'dlc_support', 'subscription_mgmt']
      },
      totalProcessed: 0
    });

    // 🏠 IoT Smart Home Device
    this.addDevice({
      id: 'iot_smart_fridge_01',
      type: 'iot_device',
      name: '🌊 UPP Smart Fridge (AI-Powered)',
      status: 'idle',
      capabilities: {
        payment_methods: ['automated', 'voice', 'mobile_app'],
        display_type: 'minimal',
        input_methods: ['sensors', 'voice', 'mobile_app'],
        special_features: ['auto_reorder', 'inventory_tracking', 'ai_recommendations']
      },
      totalProcessed: 0
    });

    // 🎙️ Voice Assistant Station
    this.addDevice({
      id: 'voice_assistant_01',
      type: 'voice_assistant',
      name: '🌊 UPP Voice Assistant (Hawaii Edition)',
      status: 'idle',
      capabilities: {
        payment_methods: ['voice', 'linked_account'],
        display_type: 'voice_only',
        input_methods: ['voice', 'wake_word'],
        special_features: ['natural_language', 'multi_language', 'hawaii_accent']
      },
      totalProcessed: 0
    });

    console.log(`🚀 Initialized ${this.devices.size} demo devices - The future is here!`);
  }

  private addDevice(device: DemoDevice) {
    this.devices.set(device.id, device);
    this.emit('deviceAdded', device);
  }

  // 💳 Start a demo payment on any device
  async startDemoPayment(deviceId: string, paymentData: {
    amount: number;
    description: string;
    customerName?: string;
  }): Promise<DemoPayment> {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} not found in demo environment`);
    }

    if (device.status !== 'idle') {
      throw new Error(`Device ${device.name} is currently ${device.status}`);
    }

    // Create demo payment
    const payment: DemoPayment = {
      id: `demo_payment_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      deviceId,
      deviceType: device.type,
      amount: paymentData.amount,
      currency: 'USD',
      description: paymentData.description,
      timestamp: new Date(),
      status: 'processing',
      method: this.getPaymentMethodForDevice(device),
      customerName: paymentData.customerName
    };

    // Update device status
    device.status = 'processing';
    device.lastPayment = payment;
    this.activePayments.set(payment.id, payment);

    console.log(`🌊 ${device.name} processing payment: $${payment.amount} for "${payment.description}"`);
    
    this.emit('paymentStarted', payment, device);

    // Simulate payment processing with realistic timing
    this.simulatePaymentProcessing(payment, device);

    return payment;
  }

  private getPaymentMethodForDevice(device: DemoDevice): DemoPayment['method'] {
    const methodMap: Record<DemoDevice['type'], DemoPayment['method']> = {
      'smartphone': 'nfc',
      'smart_tv': 'qr_code', 
      'iot_device': 'automated',
      'gaming_console': 'controller',
      'voice_assistant': 'voice'
    };
    return methodMap[device.type];
  }

  private async simulatePaymentProcessing(payment: DemoPayment, device: DemoDevice) {
    // Realistic processing times for different device types
    const processingTimes = {
      'smartphone': 2000, // NFC is fast
      'smart_tv': 9000,   // QR code generation + scan
      'iot_device': 1500, // Automated is very fast
      'gaming_console': 2500, // Controller navigation
      'voice_assistant': 3500 // Voice recognition takes a moment
    };

    const processingTime = processingTimes[device.type] + Math.random() * 1000; // Add some randomness

    setTimeout(() => {
      this.completePayment(payment.id, Math.random() > 0.05); // 95% success rate
    }, processingTime);
  }

  private completePayment(paymentId: string, success: boolean) {
    const payment = this.activePayments.get(paymentId);
    const device = payment ? this.devices.get(payment.deviceId) : null;

    if (!payment || !device) {
      console.error(`❌ Cannot complete payment ${paymentId} - payment or device not found`);
      return;
    }

    // Update payment status
    payment.status = success ? 'completed' : 'failed';
    
    // Update device
    device.status = success ? 'completed' : 'error';
    if (success) {
      device.totalProcessed += payment.amount;
      this.totalRevenue += payment.amount;
      this.sessionStats.paymentsProcessed++;
      this.sessionStats.devicesUsed.add(device.id);
    }

    // Clean up active payment
    this.activePayments.delete(paymentId);

    const statusIcon = success ? '✅' : '❌';
    const statusText = success ? 'COMPLETED' : 'FAILED';
    
    console.log(`${statusIcon} ${device.name}: Payment ${statusText} - $${payment.amount} for "${payment.description}"`);

    this.emit('paymentCompleted', payment, device, success);

    // Reset device to idle after a moment
    setTimeout(() => {
      device.status = 'idle';
      this.emit('deviceReady', device);
    }, 2000);
  }

  // 📊 Get current demo statistics
  getDemoStats() {
    const runtime = Date.now() - this.sessionStats.startTime.getTime();
    const runtimeMinutes = Math.floor(runtime / 60000);
    
    return {
      totalRevenue: this.totalRevenue,
      paymentsProcessed: this.sessionStats.paymentsProcessed,
      uniqueDevicesUsed: this.sessionStats.devicesUsed.size,
      totalDevicesAvailable: this.devices.size,
      runtimeMinutes,
      averagePaymentTime: this.sessionStats.avgPaymentTime,
      successRate: this.sessionStats.paymentsProcessed > 0 ? 
        (this.sessionStats.paymentsProcessed / (this.sessionStats.paymentsProcessed + 0)) * 100 : 100, // Simplified for now
      devicesActive: Array.from(this.devices.values()).filter(d => d.status !== 'idle').length
    };
  }

  // 🌊 Get all devices for dashboard display
  getAllDevices(): DemoDevice[] {
    return Array.from(this.devices.values());
  }

  // 🎯 Get active payments
  getActivePayments(): DemoPayment[] {
    return Array.from(this.activePayments.values());
  }

  // 🎮 Quick demo scenarios
  async runQuickDemo() {
    console.log('🌊 Running Quick Demo - Watch the magic happen!');
    
    // Simulate concurrent payments on different devices
    const demoScenarios = [
      { deviceId: 'smartphone_demo_01', amount: 4.99, description: 'Coffee & Croissant', customerName: 'Sarah from Waikiki' },
      { deviceId: 'smart_tv_demo_01', amount: 24.99, description: 'Netflix Premium Upgrade', customerName: 'Mike from Honolulu' },
      { deviceId: 'gaming_console_01', amount: 9.99, description: 'Battle Pass Season 12', customerName: 'Gaming_Pro_808' },
      { deviceId: 'iot_smart_fridge_01', amount: 127.43, description: 'Weekly Grocery Restock', customerName: 'Smart Fridge Auto-Order' },
      { deviceId: 'voice_assistant_01', amount: 15.99, description: 'Premium Music Subscription', customerName: 'Voice User Aloha123' }
    ];

    // Start all payments with realistic delays
    for (let i = 0; i < demoScenarios.length; i++) {
      setTimeout(() => {
        this.startDemoPayment(demoScenarios[i].deviceId, demoScenarios[i]);
      }, i * 1000); // 1 second apart
    }

    console.log('🚀 Quick Demo started - All devices will process payments!');
  }

  // 🔄 Reset demo environment
  resetDemo() {
    this.activePayments.clear();
    this.totalRevenue = 0;
    this.sessionStats = {
      paymentsProcessed: 0,
      devicesUsed: new Set<string>(),
      startTime: new Date(),
      avgPaymentTime: 0
    };

    // Reset all devices
    for (const device of this.devices.values()) {
      device.status = 'idle';
      device.totalProcessed = 0;
      device.lastPayment = undefined;
    }

    console.log('🔄 Demo environment reset - Ready for next session!');
    this.emit('demoReset');
  }
}

// 🌊 Export for the ultimate demo experience
export const ultimateDemo = new UltimateUPPDemo();

// Demo event handlers for logging
ultimateDemo.on('paymentStarted', (payment, device) => {
  console.log(`🌊 PAYMENT STARTED: ${device.name} processing $${payment.amount}`);
});

ultimateDemo.on('paymentCompleted', (payment, device, success) => {
  const emoji = success ? '🎉' : '😞';
  console.log(`${emoji} PAYMENT ${success ? 'SUCCESS' : 'FAILED'}: ${device.name} - $${payment.amount}`);
});

ultimateDemo.on('deviceReady', (device) => {
  console.log(`✨ ${device.name} is ready for next payment!`);
});