// 🌊 DEMO PAYMENT PROCESSOR - REAL STRIPE PAYMENTS FOR THE DEMO!
// This will process actual payments to show the UPP works with real money! 💰

import Stripe from 'stripe';
import crypto from 'crypto';
import { createPaymentProcessor, PaymentProcessor } from '../payments/payment-processor-factory.js';

import { ultimateDemo, DemoDevice, DemoPayment } from './UltimateUPPDemo.js';

export interface DemoPaymentRequest {
  deviceId: string;
  amount: number;
  currency: string;
  description: string;
  customerEmail?: string;
  customerName?: string;
  demoMode?: boolean; // If true, use test payments
}

export interface DemoPaymentResult {
  success: boolean;
  paymentIntentId?: string;
  clientSecret?: string;
  error?: string;
  demoPayment: DemoPayment;
  device: DemoDevice;
  processingTime: number;
}

export class DemoPaymentProcessor {
  private paymentProcessor: PaymentProcessor;
  private isTestMode: boolean;
  private demoStats = {
    totalPayments: 0,
    totalRevenue: 0,
    successfulPayments: 0,
    failedPayments: 0,
    avgProcessingTime: 0,
    deviceUsageCount: new Map<string, number>()
  };

  constructor(testMode = true) {
    this.isTestMode = testMode;

    try {
      this.paymentProcessor = createPaymentProcessor();
      console.log('🌊 Demo Payment Processor initialized with UPP Native Gateway!');
    } catch (error) {
      console.error('⚠️ UPP Gateway error - using simulation mode');
      this.paymentProcessor = createPaymentProcessor(); // Will create mock processorue;
    }
  }

  async processDemoPayment(request: DemoPaymentRequest): Promise<DemoPaymentResult> {
    const startTime = Date.now();

    console.log(`🌊 Processing demo payment: $${request.amount} on device ${request.deviceId}`);

    try {
      // Start demo payment in our system
      const demoPayment = await ultimateDemo.startDemoPayment(request.deviceId, {
        amount: request.amount,
        description: request.description,
        customerName: request.customerName
      });

      const device = ultimateDemo.getAllDevices().find(d => d.id === request.deviceId);
      if (!device) {
        throw new Error(`Device ${request.deviceId} not found`);
      }

      let stripeResult;

      if (this.isTestMode || request.demoMode) {
        // Simulate payment for demo
        stripeResult = await this.simulatePayment(request);
      } else {
        // Process real payment through UPP Gateway
        stripeResult = await this.processRealPayment(request, device);
      }

      const processingTime = Date.now() - startTime;

      // Update demo stats
      this.updateDemoStats(request.deviceId, request.amount, stripeResult.success, processingTime);

      const result: DemoPaymentResult = {
        success: stripeResult.success,
        paymentIntentId: stripeResult.paymentIntentId,
        clientSecret: stripeResult.clientSecret,
        error: stripeResult.error,
        demoPayment,
        device,
        processingTime
      };

      console.log(`${stripeResult.success ? '✅' : '❌'} Demo payment ${stripeResult.success ? 'completed' : 'failed'}: $${request.amount}`);

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error('💥 Demo payment processing error:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        demoPayment: await ultimateDemo.startDemoPayment(request.deviceId, {
          amount: request.amount,
          description: request.description,
          customerName: request.customerName
        }),
        device: ultimateDemo.getAllDevices().find(d => d.id === request.deviceId)!,
        processingTime
      };
    }
  }

  private async simulateStripePayment(request: DemoPaymentRequest) {
    // Simulate realistic processing time
    const processingDelay = 1500 + Math.random() * 2000;
    await new Promise(resolve => setTimeout(resolve, processingDelay));

    // Simulate 95% success rate
    const success = Math.random() > 0.05;

    if (success) {
      return {
        success: true,
        paymentIntentId: `pi_demo_${Date.now()}_${Math.random().toString(36).substring(2)}`,
        clientSecret: `pi_demo_${Date.now()}_secret_${Math.random().toString(36).substring(2)}`,
      };
    } else {
      return {
        success: false,
        error: 'Demo payment simulation failed (5% failure rate for realism)'
      };
    }
  }

  private async processRealStripePayment(request: DemoPaymentRequest, device: DemoDevice) {
    if (!this.stripeProcessor) {
      return {
        success: false,
        error: 'Stripe processor not available'
      };
    }

    try {
      // Create device-specific payment metadata
      const metadata = {
        demo_session: 'true',
        device_id: device.id,
        device_type: device.type,
        device_name: device.name,
        demo_timestamp: new Date().toISOString(),
        customer_name: request.customerName || 'Demo Customer'
      };

      // Process through our Stripe integration
      const result = await this.stripeProcessor.processDevicePayment({
        amount: request.amount,
        deviceType: device.type,
        deviceId: device.id,
        description: `🌊 UPP Demo: ${request.description}`,
        customerEmail: request.customerEmail || 'demo@upp.dev',
        metadata
      });

      return {
        success: result.success,
        paymentIntentId: (result as any).paymentIntentId || (result as any).payment_intent_id,
        clientSecret: (result as any).clientSecret || (result as any).client_secret,
        error: (result as any).error || (result as any).error_message
      };

    } catch (error) {
      return {
        success: false,
        error: `Stripe processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private updateDemoStats(deviceId: string, amount: number, success: boolean, processingTime: number) {
    this.demoStats.totalPayments++;

    if (success) {
      this.demoStats.successfulPayments++;
      this.demoStats.totalRevenue += amount;
    } else {
      this.demoStats.failedPayments++;
    }

    // Update average processing time
    const totalProcessingTime = (this.demoStats.avgProcessingTime * (this.demoStats.totalPayments - 1)) + processingTime;
    this.demoStats.avgProcessingTime = totalProcessingTime / this.demoStats.totalPayments;

    // Update device usage count
    const currentCount = this.demoStats.deviceUsageCount.get(deviceId) || 0;
    this.demoStats.deviceUsageCount.set(deviceId, currentCount + 1);
  }

  private async processRealPayment(request: DemoPaymentRequest, device: DemoDevice) {
    try {
      // Create device-specific payment metadata
      const metadata = {
        demo_session: 'true',
        device_id: device.id,
        device_type: device.type,
        device_name: device.name,
        demo_timestamp: new Date().toISOString(),
        customer_name: request.customerName || 'Demo Customer'
      };

      // Process through our UPP Gateway
      const result = await this.paymentProcessor.processDevicePayment({
        amount: request.amount,
        device_type: device.type,
        device_id: device.id,
        description: `🌊 UPP Demo: ${request.description}`,
        customer_email: request.customerEmail || 'demo@upp.dev',
        customer_name: request.customerName || 'Demo Customer',
        metadata
      });

      return {
        success: result.success,
        paymentIntentId: result.transaction_id,
        clientSecret: `${result.transaction_id}_secret`,
        error: result.error_message
      };

    } catch (error) {
      return {
        success: false,
        error: `UPP Gateway processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async simulatePayment(request: DemoPaymentRequest) {
    // Simulate realistic processing time
    const processingDelay = 1500 + Math.random() * 2000;
    await new Promise(resolve => setTimeout(resolve, processingDelay));

    // Simulate 95% success rate
    const success = Math.random() > 0.05;

    // Generate cryptographically secure random strings for IDs/secrets
    const randomString = crypto.randomBytes(16).toString('hex');

    if (success) {
      return {
        success: true,
        paymentIntentId: `pi_demo_${Date.now()}_${randomString}`,
        clientSecret: `pi_demo_${Date.now()}_secret_${randomString}`,
      };
    } else {
      return {
        success: false,
        error: 'Demo payment simulation failed (5% failure rate for realism)'
      };
    }
  }

  // 📊 Get comprehensive demo statistics
  getDemoStatistics() {
    const successRate = this.demoStats.totalPayments > 0 ?
      (this.demoStats.successfulPayments / this.demoStats.totalPayments) * 100 : 0;

    return {
      totalPayments: this.demoStats.totalPayments,
      totalRevenue: this.demoStats.totalRevenue,
      successfulPayments: this.demoStats.successfulPayments,
      failedPayments: this.demoStats.failedPayments,
      successRate: Math.round(successRate * 100) / 100,
      avgProcessingTime: Math.round(this.demoStats.avgProcessingTime),
      deviceUsageStats: Object.fromEntries(this.demoStats.deviceUsageCount),
      isTestMode: this.isTestMode
    };
  }

  // 🎯 Predefined demo scenarios for different audiences
  async runInvestorDemo(): Promise<DemoPaymentResult[]> {
    console.log('🌊 Running INVESTOR DEMO - High value transactions!');

    const investorScenarios: DemoPaymentRequest[] = [
      {
        deviceId: 'smartphone_demo_01',
        amount: 89.99,
        currency: 'USD',
        description: 'Premium B2B Software License',
        customerName: 'Enterprise Customer',
        demoMode: true
      },
      {
        deviceId: 'smart_tv_demo_01',
        amount: 299.99,
        currency: 'USD',
        description: 'Smart TV Premium Content Package',
        customerName: 'Premium Subscriber',
        demoMode: true
      },
      {
        deviceId: 'iot_smart_fridge_01',
        amount: 450.00,
        currency: 'USD',
        description: 'Automated Corporate Catering Order',
        customerName: 'TechCorp Office Building',
        demoMode: true
      }
    ];

    const results: DemoPaymentResult[] = [];

    for (let i = 0; i < investorScenarios.length; i++) {
      const scenario = investorScenarios[i];
      if (scenario) {
        const result = await this.processDemoPayment(scenario);
        results.push(result);

        // Stagger payments for dramatic effect
        if (i < investorScenarios.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    return results;
  }

  async runDeveloperDemo(): Promise<DemoPaymentResult[]> {
    console.log('🌊 Running DEVELOPER DEMO - Showcasing technical capabilities!');

    const developerScenarios: DemoPaymentRequest[] = [
      {
        deviceId: 'gaming_console_01',
        amount: 19.99,
        currency: 'USD',
        description: 'API Integration Testing Credit',
        customerName: 'DevTeam_Alpha',
        demoMode: true
      },
      {
        deviceId: 'voice_assistant_01',
        amount: 5.99,
        currency: 'USD',
        description: 'Voice SDK Premium Features',
        customerName: 'Voice_Developer_42',
        demoMode: true
      },
      {
        deviceId: 'smartphone_demo_01',
        amount: 0.99,
        currency: 'USD',
        description: 'Micro-transaction Test',
        customerName: 'Mobile_Dev_Testing',
        demoMode: true
      }
    ];

    const results: DemoPaymentResult[] = [];

    for (const scenario of developerScenarios) {
      const result = await this.processDemoPayment(scenario);
      results.push(result);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    return results;
  }

  async runConsumerDemo(): Promise<DemoPaymentResult[]> {
    console.log('🌊 Running CONSUMER DEMO - Everyday payment scenarios!');

    const consumerScenarios: DemoPaymentRequest[] = [
      {
        deviceId: 'smartphone_demo_01',
        amount: 4.50,
        currency: 'USD',
        description: 'Morning Coffee & Pastry',
        customerName: 'Sarah from Waikiki',
        customerEmail: 'sarah.w@email.com',
        demoMode: true
      },
      {
        deviceId: 'smart_tv_demo_01',
        amount: 12.99,
        currency: 'USD',
        description: 'Movie Rental HD',
        customerName: 'Movie Night Family',
        demoMode: true
      },
      {
        deviceId: 'iot_smart_fridge_01',
        amount: 67.84,
        currency: 'USD',
        description: 'Weekly Grocery Auto-Restock',
        customerName: 'Smart Home User',
        demoMode: true
      }
    ];

    const results: DemoPaymentResult[] = [];

    for (const scenario of consumerScenarios) {
      const result = await this.processDemoPayment(scenario);
      results.push(result);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return results;
  }

  // 🔄 Reset demo statistics
  resetDemoStats() {
    this.demoStats = {
      totalPayments: 0,
      totalRevenue: 0,
      successfulPayments: 0,
      failedPayments: 0,
      avgProcessingTime: 0,
      deviceUsageCount: new Map<string, number>()
    };

    console.log('🔄 Demo statistics reset');
  }

  // 🌊 Enable/disable test mode
  setTestMode(testMode: boolean) {
    this.isTestMode = testMode;
    console.log(`🌊 Demo payment processor ${testMode ? 'TEST' : 'LIVE'} mode enabled`);
  }
}

// 🌊 Export the demo payment processor
export const demoPaymentProcessor = new DemoPaymentProcessor(true); // Start in test mode for safety

// Set up demo event handlers
ultimateDemo.on('paymentStarted', (payment, device) => {
  console.log(`🌊 Demo payment started: ${device.name} processing $${payment.amount}`);
});

ultimateDemo.on('paymentCompleted', (payment, device, success) => {
  const emoji = success ? '🎉' : '😞';
  console.log(`${emoji} Demo payment ${success ? 'completed' : 'failed'}: ${device.name} - $${payment.amount}`);
});