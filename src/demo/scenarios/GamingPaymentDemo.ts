import { UniversalPaymentProtocol } from '../../modules/universal-payment-protocol/core/UPPProtocol';
import { GamingConsoleAdapter } from '../adapters/GamingConsoleAdapter';

export class GamingPaymentDemo {
  constructor(private upp: UniversalPaymentProtocol) {}

  async execute(): Promise<void> {
    console.log('🎮 DEMO 5: ULTIMATE TEST - Gaming Console Payment');
    console.log('================================================');
    
    const ps5 = new GamingConsoleAdapter({
      type: 'playstation_5',
      model: 'PS5 Digital',
      location: 'Game Room'
    });

    const deviceId = await this.upp.registerDevice(ps5);
    console.log(`✅ PlayStation 5 registered: ${deviceId}`);

    const gamePurchase = {
      type: 'controller_input',
      amount: 69.99,
      merchant: 'PlayStation Store',
      merchant_id: 'psn_store',
      item: 'Spider-Man 2 Digital Deluxe',
      payment_method: 'controller_navigation'
    };

    console.log('🎮 Using PS5 controller to buy Spider-Man 2...');
    const result = await this.upp.processPayment(deviceId, gamePurchase);
    
    console.log(`${result.success ? '✅' : '❌'} Gaming Payment ${result.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`   Game: Spider-Man 2 Digital Deluxe`);
    console.log(`   Amount: $${result.amount}`);
    console.log(`   Download: Starting now! 🕷️\n`);

    console.log('🤯 MIND = BLOWN! Even a gaming console can process payments!');
    console.log('This is the power of Universal Payment Protocol! 🌊');
  }
}