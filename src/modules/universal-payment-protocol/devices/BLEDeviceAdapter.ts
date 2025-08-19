import { z } from 'zod';
import { UPPDevice, PaymentRequest, PaymentResult, DeviceCapabilities, IoTResponse, SecurityContext } from '../core/types.js';
import { UPPError } from '../../../utils/errors.js';
import { secureLogger } from '../../../shared/logger.js';

// BLE Service and Characteristic UUIDs for UPP
export const UPP_BLE_SERVICE_UUID = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E';
export const UPP_PAYMENT_CHARACTERISTIC_UUID = '6E400002-B5A3-F393-E0A9-E50E24DCCA9E';
export const UPP_STATUS_CHARACTERISTIC_UUID = '6E400003-B5A3-F393-E0A9-E50E24DCCA9E';
export const UPP_NOTIFICATION_CHARACTERISTIC_UUID = '6E400004-B5A3-F393-E0A9-E50E24DCCA9E';

// BLE Device Information
const BLEDeviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(), // MAC address
  rssi: z.number(), // Signal strength
  services: z.array(z.string()), // Service UUIDs
  characteristics: z.array(z.string()), // Characteristic UUIDs
  isConnected: z.boolean().default(false),
  batteryLevel: z.number().min(0).max(100).optional(),
  firmwareVersion: z.string().optional(),
});

export type BLEDevice = z.infer<typeof BLEDeviceSchema>;

// BLE Command Types
export enum BLECommandType {
  SCAN_DEVICES = 'SCAN_DEVICES',
  CONNECT_DEVICE = 'CONNECT_DEVICE',
  DISCONNECT_DEVICE = 'DISCONNECT_DEVICE',
  SEND_PAYMENT = 'SEND_PAYMENT',
  READ_STATUS = 'READ_STATUS',
  WRITE_CONFIG = 'WRITE_CONFIG',
}

// BLE Payment Message Format
const BLEPaymentMessageSchema = z.object({
  messageType: z.enum(['payment_request', 'payment_response', 'status_update', 'error']),
  transactionId: z.string(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  deviceId: z.string(),
  timestamp: z.number(),
  signature: z.string().optional(), // Message signature for security
  metadata: z.record(z.string(), z.any()).optional(),
});

export type BLEPaymentMessage = z.infer<typeof BLEPaymentMessageSchema>;

export interface BLEDeviceConfig {
  scanTimeout: number; // Scan timeout in milliseconds
  connectionTimeout: number;
  maxConcurrentConnections: number;
  maxTransactionAmount: number; // Maximum transaction amount in cents
  enableEncryption: boolean;
  requiredServices: string[]; // Required BLE services
  deviceFilters: {
    namePrefix?: string;
    manufacturerId?: number;
    serviceUuids?: string[];
  };
  powerLevel: 'low' | 'medium' | 'high';
  advertisingInterval: number; // Advertising interval in ms
}

/**
 * BLE Device Adapter for IoT and wearable device communication
 * Supports GATT protocol, device discovery, and real-time communication
 */
export class BLEDeviceAdapter implements UPPDevice {
  private config: BLEDeviceConfig;
  private isInitialized = false;
  private connectedDevices = new Map<string, BLEDevice>();
  private scanningActive = false;
  private bleManager?: any; // Platform-specific BLE manager

  constructor(config: Partial<BLEDeviceConfig> = {}) {
    this.config = {
      scanTimeout: 10000, // 10 seconds
      connectionTimeout: 5000, // 5 seconds
      maxConcurrentConnections: 5,
      maxTransactionAmount: 100000, // $1,000
      enableEncryption: true,
      requiredServices: [UPP_BLE_SERVICE_UUID],
      deviceFilters: {
        namePrefix: 'UPP-',
        serviceUuids: [UPP_BLE_SERVICE_UUID],
      },
      powerLevel: 'medium',
      advertisingInterval: 100,
      ...config,
    };
  }

  // UPPDevice interface implementation
  getDeviceId(): string {
    return `ble-${this.getDeviceFingerprint()}`;
  }

  getDeviceType(): string {
    return 'BLE_IOT_GATEWAY';
  }

  getFingerprint(): string {
    return this.hashConfig();
  }

  getSecurityContext(): SecurityContext {
    return {
      encryptionLevel: this.config.enableEncryption ? 'AES256' : 'BASIC',
      deviceAttestation: 'ble_device',
      trustedEnvironment: false
    };
  }

  getCapabilities(): DeviceCapabilities {
    return {
      hasDisplay: false,
      hasCamera: false,
      hasNFC: false,
      hasBluetooth: true,
      hasWiFi: false,
      hasKeypad: false,
      hasTouchScreen: false,
      hasVoiceInput: false,
      hasVoiceOutput: false,
      hasPrinter: false,
      supportsEncryption: true,
      internet_connection: false,
      maxPaymentAmount: this.config.maxTransactionAmount || 100000, // $1,000
      supportedCurrencies: ['USD', 'EUR', 'GBP'],
      securityLevel: 'STANDARD'
    };
  }

  getDeviceFingerprint(): string {
    return this.hashConfig();
  }

  async handlePaymentResponse(response: PaymentResult): Promise<IoTResponse> {
    const connectedDeviceCount = this.connectedDevices.size;
    
    return {
      success: response.success,
      deviceCount: connectedDeviceCount,
      status: response.success ? 'payment_completed' : 'payment_failed',
      ledPattern: response.success ? 'success_blink' : 'error_blink',
      metadata: {
        transactionId: response.transactionId,
        connectedDevices: Array.from(this.connectedDevices.keys()),
        bleSignalStrength: this.getAverageRSSI(),
      },
    };
  }

  async handleError(error: UPPError): Promise<void> {
    console.error(`BLE Device Error: ${error.message}`);
    
    // Notify all connected devices of error
    await this.notifyAllDevices({
      messageType: 'error',
      transactionId: '',
      amount: 0,
      currency: 'USD',
      deviceId: this.getDeviceId(),
      timestamp: Date.now(),
      metadata: { error: error.message },
    });

    // Disconnect unstable connections
    await this.cleanupConnections();
  }

  // BLE-specific methods

  /**
   * Initialize BLE adapter and configure GATT services
   */
  async initializeBLE(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize platform-specific BLE manager
      await this.initializePlatformBLE();
      
      // Setup GATT server and services
      await this.setupGATTServer();
      
      // Configure advertising
      await this.configureAdvertising();

      this.isInitialized = true;
      console.log('BLE Device Adapter initialized successfully');
    } catch (error) {
      throw new UPPError(`Failed to initialize BLE: ${error}`, 'BLE_INIT_ERROR');
    }
  }

  /**
   * Scan for BLE devices with UPP service
   */
  async scanForDevices(timeout?: number): Promise<BLEDevice[]> {
    if (!this.isInitialized) {
      await this.initializeBLE();
    }

    const scanTimeout = timeout || this.config.scanTimeout;
    const discoveredDevices: BLEDevice[] = [];

    return new Promise((resolve, reject) => {
      if (this.scanningActive) {
        reject(new UPPError('BLE scan already in progress', 'BLE_SCAN_IN_PROGRESS'));
        return;
      }

      this.scanningActive = true;
      console.log(`Starting BLE device scan (${scanTimeout}ms timeout)...`);

      const scanTimeoutId = setTimeout(() => {
        this.scanningActive = false;
        this.stopScan();
        resolve(discoveredDevices);
      }, scanTimeout);

      this.startScan()
        .then((devices) => {
          clearTimeout(scanTimeoutId);
          this.scanningActive = false;
          
          // Filter devices based on configuration
          const filteredDevices = devices.filter(device => 
            this.matchesDeviceFilters(device)
          );
          
          resolve(filteredDevices);
        })
        .catch((error) => {
          clearTimeout(scanTimeoutId);
          this.scanningActive = false;
          reject(new UPPError(`BLE scan failed: ${error.message}`, 'BLE_SCAN_ERROR'));
        });
    });
  }

  /**
   * Connect to a specific BLE device
   */
  async connectToDevice(deviceId: string): Promise<void> {
    if (this.connectedDevices.has(deviceId)) {
      console.log(`Device ${deviceId} already connected`);
      return;
    }

    if (this.connectedDevices.size >= this.config.maxConcurrentConnections) {
      throw new UPPError(`Maximum concurrent connections (${this.config.maxConcurrentConnections}) reached`, 'BLE_MAX_CONNECTIONS');
    }

    try {
      console.log(`Connecting to BLE device: ${deviceId}`);
      
      // Establish BLE connection
      const device = await this.establishConnection(deviceId);
      
      // Discover services and characteristics
      await this.discoverServices(device);
      
      // Setup notifications
      await this.setupNotifications(device);
      
      // Store connected device
      this.connectedDevices.set(deviceId, { ...device, isConnected: true });
      
      console.log(`Successfully connected to device: ${deviceId}`);
    } catch (error) {
      throw new UPPError(`Failed to connect to device ${deviceId}: ${error}`, 'BLE_CONNECTION_ERROR');
    }
  }

  /**
   * Disconnect from a BLE device
   */
  async disconnectDevice(deviceId: string): Promise<void> {
    const device = this.connectedDevices.get(deviceId);
    if (!device) {
      console.log(`Device ${deviceId} not connected`);
      return;
    }

    try {
      // Send disconnect notification
      await this.sendDisconnectNotification(device);
      
      // Close connection
      await this.closeConnection(deviceId);
      
      // Remove from connected devices
      this.connectedDevices.delete(deviceId);
      
      console.log(`Disconnected from device: ${deviceId}`);
    } catch (error) {
      console.error(`Error disconnecting from device ${deviceId}:`, error);
      // Force remove from connected devices even if disconnect failed
      this.connectedDevices.delete(deviceId);
    }
  }

  /**
   * Send payment request to specific BLE device
   */
  async sendPaymentRequest(deviceId: string, request: PaymentRequest): Promise<PaymentResult> {
    const device = this.connectedDevices.get(deviceId);
    if (!device) {
      throw new UPPError(`Device ${deviceId} not connected`, 'BLE_DEVICE_NOT_CONNECTED');
    }

    try {
      // Create payment message
      const paymentMessage: BLEPaymentMessage = {
        messageType: 'payment_request',
        transactionId: `ble_${Date.now()}_${Math.random().toString(36).substring(2)}`,
        amount: request.amount,
        currency: request.currency,
        deviceId: this.getDeviceId(),
        timestamp: Date.now(),
        metadata: request.metadata,
      };

      // Add message signature if encryption is enabled
      if (this.config.enableEncryption) {
        paymentMessage.signature = await this.signMessage(paymentMessage);
      }

      // Send message to device
      await this.writeCharacteristic(device, UPP_PAYMENT_CHARACTERISTIC_UUID, paymentMessage);
      
      // Wait for response
      const response = await this.waitForPaymentResponse(device, paymentMessage.transactionId);
      
      return response;
    } catch (error) {
      return {
        success: false,
        transactionId: '',
        amount: request.amount,
        currency: request.currency,
        error: error instanceof UPPError ? error.message : 'BLE payment failed',
        metadata: {
          deviceId,
          bleError: true,
        },
      };
    }
  }

  /**
   * Broadcast payment request to all connected devices
   */
  async broadcastPaymentRequest(request: PaymentRequest): Promise<PaymentResult[]> {
    if (this.connectedDevices.size === 0) {
      throw new UPPError('No connected BLE devices available', 'BLE_NO_DEVICES');
    }

    const promises = Array.from(this.connectedDevices.keys()).map(deviceId =>
      this.sendPaymentRequest(deviceId, request)
    );

    return Promise.all(promises);
  }

  /**
   * Read device status from all connected devices
   */
  async readDeviceStatus(): Promise<Map<string, any>> {
    const statusMap = new Map<string, any>();

    for (const [deviceId, device] of this.connectedDevices) {
      try {
        const status = await this.readCharacteristic(device, UPP_STATUS_CHARACTERISTIC_UUID);
        statusMap.set(deviceId, status);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        statusMap.set(deviceId, { error: errorMessage });
      }
    }

    return statusMap;
  }

  // Private helper methods

  private async initializePlatformBLE(): Promise<void> {
    // Platform-specific BLE initialization
    console.log('Initializing platform BLE adapter...');
    
    // In real implementation, this would:
    // - Initialize Bluetooth adapter
    // - Check permissions
    // - Validate hardware capabilities
    // - Setup event handlers
  }

  private async setupGATTServer(): Promise<void> {
    // Setup GATT server with UPP services
    console.log('Setting up GATT server with UPP services...');
    
    const services = [
      {
        uuid: UPP_BLE_SERVICE_UUID,
        characteristics: [
          {
            uuid: UPP_PAYMENT_CHARACTERISTIC_UUID,
            properties: ['read', 'write', 'notify'],
          },
          {
            uuid: UPP_STATUS_CHARACTERISTIC_UUID,
            properties: ['read', 'notify'],
          },
          {
            uuid: UPP_NOTIFICATION_CHARACTERISTIC_UUID,
            properties: ['notify'],
          },
        ],
      },
    ];

    // Register services with BLE stack
    console.log('GATT services registered:', services);
  }

  private async configureAdvertising(): Promise<void> {
    // Configure BLE advertising
    const advertisingData = {
      localName: `UPP-Gateway-${this.getDeviceFingerprint().slice(-4)}`,
      serviceUuids: [UPP_BLE_SERVICE_UUID],
      manufacturerData: Buffer.from([0x4D, 0x49, 0x4E, 0x44]), // "MIND" in hex
      txPowerLevel: this.config.powerLevel === 'high' ? 4 : 0,
    };

    console.log('BLE advertising configured:', advertisingData);
  }

  private async startScan(): Promise<BLEDevice[]> {
    // Start BLE device scanning
    // This would interface with actual BLE hardware
    
    // Simulate discovered devices
    const simulatedDevices: BLEDevice[] = [
      {
        id: 'ble-device-001',
        name: 'UPP-SmartWatch-001',
        address: '12:34:56:78:90:AB',
        rssi: -45,
        services: [UPP_BLE_SERVICE_UUID],
        characteristics: [UPP_PAYMENT_CHARACTERISTIC_UUID, UPP_STATUS_CHARACTERISTIC_UUID],
        isConnected: false,
        batteryLevel: 85,
        firmwareVersion: '1.2.3',
      },
      {
        id: 'ble-device-002',
        name: 'UPP-IoT-Sensor-002',
        address: 'CD:EF:12:34:56:78',
        rssi: -60,
        services: [UPP_BLE_SERVICE_UUID],
        characteristics: [UPP_PAYMENT_CHARACTERISTIC_UUID, UPP_STATUS_CHARACTERISTIC_UUID],
        isConnected: false,
        batteryLevel: 92,
        firmwareVersion: '2.1.0',
      },
    ];

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(simulatedDevices);
      }, 3000); // Simulate 3-second scan
    });
  }

  private async stopScan(): Promise<void> {
    console.log('Stopping BLE scan...');
  }

  private matchesDeviceFilters(device: BLEDevice): boolean {
    const filters = this.config.deviceFilters;
    
    if (filters.namePrefix && !device.name.startsWith(filters.namePrefix)) {
      return false;
    }
    
    if (filters.serviceUuids) {
      const hasRequiredService = filters.serviceUuids.some(uuid => 
        device.services.includes(uuid)
      );
      if (!hasRequiredService) {
        return false;
      }
    }
    
    return true;
  }

  private async establishConnection(deviceId: string): Promise<BLEDevice> {
    // Establish BLE connection
    console.log(`Establishing connection to ${deviceId}...`);
    
    // Simulate connection
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Simulate successful connection
        const device: BLEDevice = {
          id: deviceId,
          name: `UPP-Device-${deviceId.slice(-3)}`,
          address: '12:34:56:78:90:AB',
          rssi: -50,
          services: [UPP_BLE_SERVICE_UUID],
          characteristics: [UPP_PAYMENT_CHARACTERISTIC_UUID, UPP_STATUS_CHARACTERISTIC_UUID],
          isConnected: true,
          batteryLevel: 80,
        };
        
        resolve(device);
      }, 2000);
    });
  }

  private async discoverServices(device: BLEDevice): Promise<void> {
    console.log(`Discovering services for device: ${device.id}`);
    
    // Validate required services are present
    for (const requiredService of this.config.requiredServices) {
      if (!device.services.includes(requiredService)) {
        throw new UPPError(`Required service ${requiredService} not found on device ${device.id}`, 'BLE_SERVICE_NOT_FOUND');
      }
    }
  }

  private async setupNotifications(device: BLEDevice): Promise<void> {
    console.log(`Setting up notifications for device: ${device.id}`);
    
    // Enable notifications for relevant characteristics
    const notificationCharacteristics = [
      UPP_STATUS_CHARACTERISTIC_UUID,
      UPP_NOTIFICATION_CHARACTERISTIC_UUID,
    ];

    for (const characteristicUuid of notificationCharacteristics) {
      if (device.characteristics.includes(characteristicUuid)) {
        // Enable notifications
        console.log(`Enabled notifications for characteristic: ${characteristicUuid}`);
      }
    }
  }

  private async writeCharacteristic(device: BLEDevice, characteristicUuid: string, data: any): Promise<void> {
    const message = JSON.stringify(data);
    const buffer = Buffer.from(message, 'utf8');
    
    console.log(`Writing to characteristic ${characteristicUuid} on device ${device.id}:`, message);
    
    // In real implementation, this would write to the actual BLE characteristic
  }

  private async readCharacteristic(device: BLEDevice, characteristicUuid: string): Promise<any> {
    console.log(`Reading from characteristic ${characteristicUuid} on device ${device.id}`);
    
    // Simulate characteristic read
    const simulatedData = {
      deviceId: device.id,
      timestamp: Date.now(),
      batteryLevel: device.batteryLevel,
      status: 'connected',
    };
    
    return simulatedData;
  }

  private async waitForPaymentResponse(device: BLEDevice, transactionId: string): Promise<PaymentResult> {
    // Wait for payment response from device
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulate successful payment response
        const response: PaymentResult = {
          success: true,
          transactionId,
          amount: 1000,
          currency: 'USD',
          timestamp: new Date(),
          metadata: {
            deviceId: device.id,
            blePayment: true,
            deviceBattery: device.batteryLevel,
          },
        };
        
        resolve(response);
      }, 3000); // Simulate 3-second processing time
    });
  }

  private async signMessage(message: BLEPaymentMessage): Promise<string> {
    // Create message signature for security
    const messageString = JSON.stringify(message);
    const signature = Buffer.from(messageString).toString('base64');
    
    return signature;
  }

  private async notifyAllDevices(message: BLEPaymentMessage): Promise<void> {
    const promises = Array.from(this.connectedDevices.values()).map(device =>
      this.writeCharacteristic(device, UPP_NOTIFICATION_CHARACTERISTIC_UUID, message)
    );

    await Promise.all(promises);
  }

  private async cleanupConnections(): Promise<void> {
    // Clean up unstable or failed connections
    const deviceIds = Array.from(this.connectedDevices.keys());
    
    for (const deviceId of deviceIds) {
      try {
        // Check connection health
        const device = this.connectedDevices.get(deviceId)!;
        if (device.rssi < -80) {
          // Weak signal, disconnect
          await this.disconnectDevice(deviceId);
        }
      } catch (error) {
        // Force disconnect if health check fails
        this.connectedDevices.delete(deviceId);
      }
    }
  }

  private async sendDisconnectNotification(device: BLEDevice): Promise<void> {
    const disconnectMessage: BLEPaymentMessage = {
      messageType: 'status_update',
      transactionId: '',
      amount: 0,
      currency: 'USD',
      deviceId: this.getDeviceId(),
      timestamp: Date.now(),
      metadata: { status: 'disconnecting' },
    };

    await this.writeCharacteristic(device, UPP_NOTIFICATION_CHARACTERISTIC_UUID, disconnectMessage);
  }

  private async closeConnection(deviceId: string): Promise<void> {
    console.log(`Closing BLE connection to device: ${deviceId}`);
    // In real implementation, this would close the actual BLE connection
  }

  private getAverageRSSI(): number {
    const devices = Array.from(this.connectedDevices.values());
    if (devices.length === 0) return 0;
    
    const totalRSSI = devices.reduce((sum, device) => sum + device.rssi, 0);
    return Math.round(totalRSSI / devices.length);
  }

  private hashConfig(): string {
    const configString = JSON.stringify(this.config);
    return Buffer.from(configString).toString('base64').substring(0, 8);
  }
}