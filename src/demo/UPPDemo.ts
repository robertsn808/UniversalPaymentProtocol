import { UniversalPaymentProtocol } from '../modules/universal-payment-protocol/core/UPPProtocol';

import { HawaiiPaymentGateway } from './gateways/HawaiiPaymentGateway';
import { GamingPaymentDemo } from './scenarios/GamingPaymentDemo';
import { IoTPaymentDemo } from './scenarios/IoTPaymentDemo';
import { SmartphonePaymentDemo } from './scenarios/SmartphonePaymentDemo';
import { SmartTVPaymentDemo } from './scenarios/SmartTVPaymentDemo';
import { VoicePaymentDemo } from './scenarios/VoicePaymentDemo';
import { DemoConfig, DEFAULT_DEMO_CONFIG } from './types/DemoConfig';

export class UPPDemo {
  private upp: UniversalPaymentProtocol;
  private config: DemoConfig;
  private scenarios: Array<{ name: string; demo: any; enabled: boolean }> = [];

  constructor(config: Partial<DemoConfig> = {}) {
    this.config = { ...DEFAULT_DEMO_CONFIG, ...config };
    
    if (this.config.enableLogging) {
      console.log('🌊 Universal Payment Protocol Demo Starting!');
    }
    
    this.upp = new UniversalPaymentProtocol({
      paymentGateway: new HawaiiPaymentGateway(
        this.config.paymentGateway.successRate,
        this.config.paymentGateway.mockDelayMs
      ),
      security: {
        encryption_key: 'demo_key_hawaii_2025'
      },
      discovery: {
        enabled: true,
        scan_interval: 5000
      }
    });

    this.initializeScenarios();
  }

  private initializeScenarios(): void {
    this.scenarios = [
      { name: 'Smartphone', demo: new SmartphonePaymentDemo(this.upp), enabled: this.config.scenarios.smartphone },
      { name: 'Smart TV', demo: new SmartTVPaymentDemo(this.upp), enabled: this.config.scenarios.smartTV },
      { name: 'IoT Device', demo: new IoTPaymentDemo(this.upp), enabled: this.config.scenarios.iot },
      { name: 'Voice Assistant', demo: new VoicePaymentDemo(this.upp), enabled: this.config.scenarios.voice },
      { name: 'Gaming Console', demo: new GamingPaymentDemo(this.upp), enabled: this.config.scenarios.gaming }
    ];
  }

  async start(): Promise<void> {
    try {
      if (this.config.enableLogging) {
        console.log('\n🚀 UNIVERSAL PAYMENT PROTOCOL DEMO');
        console.log('=====================================');
        console.log('Watch as we connect ANY device to our payment system!\n');
      }

      const enabledScenarios = this.scenarios.filter(s => s.enabled);
      
      for (const scenario of enabledScenarios) {
        await this.executeScenario(scenario);
        
        if (enabledScenarios.indexOf(scenario) < enabledScenarios.length - 1) {
          await this.delay(this.config.delays.betweenScenarios);
        }
      }

      if (this.config.enableLogging) {
        console.log('\n🎉 DEMO COMPLETE! The future of payments is HERE!');
        console.log('Any device + Internet = Payment Terminal 💳✨');
      }
    } catch (error) {
      console.error('❌ Demo failed:', error);
      throw error;
    }
  }

  private async executeScenario(scenario: { name: string; demo: any }): Promise<void> {
    try {
      await scenario.demo.execute();
    } catch (error) {
      console.error(`❌ ${scenario.name} demo failed:`, error);
      throw error;
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async runSingleScenario(scenarioName: string): Promise<void> {
    const scenario = this.scenarios.find(s => s.name.toLowerCase().includes(scenarioName.toLowerCase()));
    
    if (!scenario) {
      throw new Error(`Scenario '${scenarioName}' not found`);
    }

    await this.executeScenario(scenario);
  }

  getAvailableScenarios(): string[] {
    return this.scenarios.map(s => s.name);
  }
}

// Start the demo when run directly
if (process.argv[1]?.endsWith('UPPDemo.ts')) {
  console.log('🌊 Welcome to the Future of Payments - Universal Payment Protocol Demo! 🌊');
  const demo = new UPPDemo();
  demo.start().catch(console.error);
}
