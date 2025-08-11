import { UniversalPaymentProtocol } from '../../modules/universal-payment-protocol/core/UPPProtocol';
import { VoiceAssistantAdapter } from '../adapters/VoiceAssistantAdapter';

export class VoicePaymentDemo {
  constructor(private upp: UniversalPaymentProtocol) {}

  async execute(): Promise<void> {
    console.log('🎤 DEMO 4: Voice Assistant Payment');
    console.log('----------------------------------');
    
    const alexa = new VoiceAssistantAdapter({
      type: 'amazon_echo',
      model: 'Echo Dot 5th Gen',
      location: 'Bedroom'
    });

    const deviceId = await this.upp.registerDevice(alexa);
    console.log(`✅ Voice Assistant registered: ${deviceId}`);

    const voiceCommand = {
      type: 'voice_command',
      transcript: 'Pay fifteen dollars to Uber for my ride to the airport',
      confidence: 0.94,
      language: 'en-US'
    };

    console.log('🗣️  "Pay fifteen dollars to Uber for my ride to the airport"');
    const result = await this.upp.processPayment(deviceId, voiceCommand);
    
    console.log(`${result.success ? '✅' : '❌'} Voice Payment ${result.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`   Uber Ride: $${result.amount}`);
    console.log(`   ETA: 5 minutes\n`);
  }
}