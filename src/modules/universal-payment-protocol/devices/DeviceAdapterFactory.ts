// Device Adapter Factory - Kai's UPP System
// Universal factory for creating device adapters

import { UPPDevice, DeviceCapabilities } from '../core/types.js';
import { SmartphoneAdapter } from './SmartphoneAdapter.js';
import { SmartTVAdapter } from './SmartTVAdapter.js';
import { IoTDeviceAdapter } from './IoTDeviceAdapter.js';
import { VoiceAssistantAdapter } from './VoiceAssistantAdapter.js';
import { GamingConsoleAdapter } from './GamingConsoleAdapter.js';
import { SmartwatchAdapter } from './SmartwatchAdapter.js';
import { CarSystemAdapter } from './CarSystemAdapter.js';

export class DeviceAdapterFactory {
  // Registry of available device adapters
  private static adapterRegistry = new Map<string, new (info: any) => UPPDevice>([
    ['smartphone', SmartphoneAdapter],
    ['smart_tv', SmartTVAdapter],
    ['iot_device', IoTDeviceAdapter],
    ['voice_assistant', VoiceAssistantAdapter],
    ['gaming_console', GamingConsoleAdapter],
    ['smartwatch', SmartwatchAdapter],
    ['car_system', CarSystemAdapter]
  ]);

  // Create a device adapter based on device type
  static createAdapter(deviceType: string, deviceInfo: any): UPPDevice {
    const AdapterClass = this.adapterRegistry.get(deviceType);
    
    if (!AdapterClass) {
      throw new Error(`No adapter available for device type: ${deviceType}`);
    }
    
    return new AdapterClass(deviceInfo);
  }

  // Register a new device adapter
  static registerAdapter(deviceType: string, adapterClass: new (info: any) => UPPDevice): void {
    this.adapterRegistry.set(deviceType, adapterClass);
    console.log(`✅ Registered adapter for device type: ${deviceType}`);
  }

  // Get list of supported device types
  static getSupportedDeviceTypes(): string[] {
    return Array.from(this.adapterRegistry.keys());
  }

  // Check if a device type is supported
  static isDeviceTypeSupported(deviceType: string): boolean {
    return this.adapterRegistry.has(deviceType);
  }

  // Detect device type based on capabilities
  static detectDeviceType(capabilities: DeviceCapabilities): string | null {
    // Smart TV detection
    if (capabilities.display === 'large' && (capabilities as any).qr_generator) {
      return 'smart_tv';
    }
    
    // IoT device detection
    if (capabilities.sensors && (capabilities as any).automated_purchasing) {
      return 'iot_device';
    }
    
    // Voice assistant detection
    if (capabilities.voice_recognition && (capabilities as any).natural_language && capabilities.speaker) {
      return 'voice_assistant';
    }
    
    // Gaming console detection
    if (capabilities.display === 'gaming' && (capabilities as any).gaming_store) {
      return 'gaming_console';
    }
    
    // Smartwatch detection
    if (capabilities.display === 'small' && (capabilities as any).haptic && (capabilities as any).heart_rate) {
      return 'smartwatch';
    }
    
    // Car system detection
    if (capabilities.display === 'automotive' && capabilities.gps && (capabilities as any).driver_monitoring) {
      return 'car_system';
    }
    
    // Smartphone detection
    if (capabilities.display === 'touchscreen' && capabilities.nfc && capabilities.biometric) {
      return 'smartphone';
    }
    
    // Generic device
    return null;
  }

  // Get device capabilities for a specific device type
  static getDeviceCapabilities(deviceType: string): DeviceCapabilities | null {
    try {
      // Create a temporary instance to get capabilities
      const AdapterClass = this.adapterRegistry.get(deviceType);
      if (!AdapterClass) return null;
      
      // Create minimal instance just to get capabilities
      const tempDevice = new AdapterClass({});
      return tempDevice.capabilities;
    } catch (error) {
      console.error(`Error getting capabilities for ${deviceType}:`, error);
      return null;
    }
  }
}

// Device adapter interface for third-party implementations
export interface DeviceAdapterInterface {
  deviceType: string;
  capabilities: DeviceCapabilities;
  securityContext: any;
  fingerprint: string;
  
  handlePaymentResponse(response: any): Promise<void>;
  handleError(error: any): Promise<void>;
  displayPaymentUI?(options: any): Promise<void>;
  captureUserInput?(): Promise<any>;
}

// Example of how to register a custom device adapter
export class CustomDeviceAdapter implements DeviceAdapterInterface {
  deviceType = 'custom_device';
  fingerprint: string;
  
  capabilities = {
    internet_connection: true,
    display: 'standard' as const,
    input_methods: ['custom_input']
  };

  securityContext = {
    encryption_level: 'AES256',
    device_attestation: 'trusted'
  };

  constructor(private _deviceInfo: any) {
    this.fingerprint = `custom_${Date.now()}`;
  }

  async handlePaymentResponse(response: any): Promise<void> {
    console.log('📱 Custom device received payment response:', response);
  }

  async handleError(error: any): Promise<void> {
    console.log('📱 Custom device handling error:', error);
  }
}

// Register the custom adapter
DeviceAdapterFactory.registerAdapter('custom_device', CustomDeviceAdapter);

// Hey, this is Kai speaking now! 🌊
// This factory makes it super easy to add new device types!
// Just create your adapter class and register it with the factory
// Then UPP will automatically support your new device type
// This is how we'll support millions of different devices!
