// Device Adapter Factory - Kai's UPP System
// Universal factory for creating device adapters
import { SmartTVAdapter } from './SmartTVAdapter';
import { IoTDeviceAdapter } from './IoTDeviceAdapter';
import { VoiceAssistantAdapter } from './VoiceAssistantAdapter';
import { GamingConsoleAdapter } from './GamingConsoleAdapter';
import { SmartwatchAdapter } from './SmartwatchAdapter';
import { CarSystemAdapter } from './CarSystemAdapter';
export class DeviceAdapterFactory {
    // Create a device adapter based on device type
    static createAdapter(deviceType, deviceInfo) {
        const AdapterClass = this.adapterRegistry.get(deviceType);
        if (!AdapterClass) {
            throw new Error(`No adapter available for device type: ${deviceType}`);
        }
        return new AdapterClass(deviceInfo);
    }
    // Register a new device adapter
    static registerAdapter(deviceType, adapterClass) {
        this.adapterRegistry.set(deviceType, adapterClass);
        console.log(`✅ Registered adapter for device type: ${deviceType}`);
    }
    // Get list of supported device types
    static getSupportedDeviceTypes() {
        return Array.from(this.adapterRegistry.keys());
    }
    // Check if a device type is supported
    static isDeviceTypeSupported(deviceType) {
        return this.adapterRegistry.has(deviceType);
    }
    // Detect device type based on capabilities
    static detectDeviceType(capabilities) {
        // Smart TV detection
        if (capabilities.display === 'large' && capabilities.qr_generator) {
            return 'smart_tv';
        }
        // IoT device detection
        if (capabilities.sensors && capabilities.automated_purchasing) {
            return 'iot_device';
        }
        // Voice assistant detection
        if (capabilities.voice_recognition && capabilities.natural_language && capabilities.speaker) {
            return 'voice_assistant';
        }
        // Gaming console detection
        if (capabilities.display === 'gaming' && capabilities.gaming_store) {
            return 'gaming_console';
        }
        // Smartwatch detection
        if (capabilities.display === 'small' && capabilities.haptic && capabilities.heart_rate) {
            return 'smartwatch';
        }
        // Car system detection
        if (capabilities.display === 'automotive' && capabilities.gps && capabilities.driver_monitoring) {
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
    static getDeviceCapabilities(deviceType) {
        try {
            // Create a temporary instance to get capabilities
            const AdapterClass = this.adapterRegistry.get(deviceType);
            if (!AdapterClass)
                return null;
            // Create minimal instance just to get capabilities
            const tempDevice = new AdapterClass({});
            return tempDevice.capabilities;
        }
        catch (error) {
            console.error(`Error getting capabilities for ${deviceType}:`, error);
            return null;
        }
    }
}
// Registry of available device adapters
DeviceAdapterFactory.adapterRegistry = new Map([
    ['smart_tv', SmartTVAdapter],
    ['iot_device', IoTDeviceAdapter],
    ['voice_assistant', VoiceAssistantAdapter],
    ['gaming_console', GamingConsoleAdapter],
    ['smartwatch', SmartwatchAdapter],
    ['car_system', CarSystemAdapter]
]);
// Example of how to register a custom device adapter
export class CustomDeviceAdapter {
    constructor(deviceInfo) {
        this.deviceInfo = deviceInfo;
        this.deviceType = 'custom_device';
        this.capabilities = {
            internet_connection: true,
            display: 'standard',
            input_methods: ['custom_input']
        };
        this.securityContext = {
            encryption_level: 'AES256',
            device_attestation: 'trusted'
        };
        this.fingerprint = `custom_${Date.now()}`;
    }
    async handlePaymentResponse(response) {
        console.log('📱 Custom device received payment response:', response);
    }
    async handleError(error) {
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
