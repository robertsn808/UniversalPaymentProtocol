import { UniversalPaymentProtocol } from '../../modules/universal-payment-protocol/core/UPPProtocol';
import { IoTDeviceAdapter } from '../adapters/IoTDeviceAdapter';

export class IoTPaymentDemo {
  constructor(private upp: UniversalPaymentProtocol) {}

  async execute(): Promise<void> {
    console.log('🏠 DEMO 3: IoT Smart Fridge Payment');
    console.log('-----------------------------------');
    
    const smartFridge = new IoTDeviceAdapter({
      type: 'smart_fridge',
      brand: 'LG InstaView',
      location: 'Kitchen'
    });

    const deviceId = await this.upp.registerDevice(smartFridge);
    console.log(`✅ Smart Fridge registered: ${deviceId}`);

    const autoOrder = {
      type: 'sensor_trigger',
      preset_amount: 127.50,
      description: 'Weekly Grocery Auto-Order',
      merchant_id: 'foodland_hi',
      items: ['Milk', 'Eggs', 'Bread', 'Local Produce'],
      trigger: 'low_inventory_detected'
    };

    console.log('🥛 Fridge detected low inventory, auto-ordering groceries...');
    const result = await this.upp.processPayment(deviceId, autoOrder);
    
    console.log(`${result.success ? '✅' : '❌'} Auto-Order ${result.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`   Groceries: $${result.amount}`);
    console.log(`   Delivery: Tomorrow 9AM\n`);
  }
}