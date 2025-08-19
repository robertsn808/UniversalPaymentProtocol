import { UniversalPaymentProtocol } from '../../modules/universal-payment-protocol/core/UPPProtocol';
import { SmartphoneAdapter } from '../../modules/universal-payment-protocol/devices/SmartphoneAdapter';

export class SmartphonePaymentDemo {
  constructor(private upp: UniversalPaymentProtocol) {}

  async execute(): Promise<void> {
    console.log('📱 DEMO 1: Smartphone Payment');
    console.log('------------------------------');
    
    const phone = new SmartphoneAdapter({
      model: 'iPhone 15 Pro',
      os: 'iOS 17',
      location: 'Honolulu, Hawaii'
    });

    const deviceId = await this.upp.registerDevice(phone);
    console.log(`✅ Smartphone registered: ${deviceId}`);

    const nfcPayment = {
      type: 'nfc_tap',
      amount: 25.99,
      merchant: 'Hawaii Coffee Co',
      merchant_id: 'hcc_001',
      location: { lat: 21.3099, lng: -157.8581 }
    };

    console.log('💳 Processing NFC payment...');
    const result = await this.upp.processPayment(deviceId, nfcPayment);
    
    console.log(`${result.success ? '✅' : '❌'} Payment ${result.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`   Amount: $${result.amount}`);
    console.log(`   Transaction: ${result.transactionId}\n`);
  }
}