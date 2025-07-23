import { UniversalPaymentProtocol } from '../../modules/universal-payment-protocol/core/UPPProtocol';
import { SmartTVAdapter } from '../adapters/SmartTVAdapter';

export class SmartTVPaymentDemo {
  constructor(private upp: UniversalPaymentProtocol) {}

  async execute(): Promise<void> {
    console.log('📺 DEMO 2: Smart TV Payment');
    console.log('----------------------------');
    
    const smartTV = new SmartTVAdapter({
      model: 'Samsung Neo QLED',
      size: '65 inch',
      location: 'Living Room'
    });

    const deviceId = await this.upp.registerDevice(smartTV);
    console.log(`✅ Smart TV registered: ${deviceId}`);

    const qrPayment = {
      type: 'qr_display',
      amount: 49.99,
      merchant: 'Netflix Hawaii',
      merchant_id: 'netflix_hi',
      service: 'Premium Subscription'
    };

    console.log('📱 Displaying QR code on TV for phone scan...');
    const result = await this.upp.processPayment(deviceId, qrPayment);
    
    console.log(`${result.success ? '✅' : '❌'} TV Payment ${result.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`   Service: Premium Subscription`);
    console.log(`   Amount: $${result.amount}\n`);
  }
}