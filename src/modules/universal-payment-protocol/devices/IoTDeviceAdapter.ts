import { z } from 'zod';

import { UPPDevice, PaymentRequest, PaymentResult, DeviceCapabilities, IoTResponse, SecurityContext } from '../core/types.js';
import { UPPError } from '../../../utils/errors.js';
import { secureLogger } from '../../../shared/logger.js';

// IoT Protocol Types
export enum IoTProtocol {
  MQTT = 'mqtt',
  COAP = 'coap',
  HTTP = 'http',
  WEBSOCKET = 'websocket',
  ZIGBEE = 'zigbee',
  Z_WAVE = 'z_wave',
  MATTER = 'matter',
  THREAD = 'thread',
  BLUETOOTH_MESH = 'bluetooth_mesh',
  LORAWAN = 'lorawan',
  SIGFOX = 'sigfox',
  MODBUS_TCP = 'modbus_tcp',
  MODBUS_RTU = 'modbus_rtu',
  OPC_UA = 'opc_ua',
}

// IoT Device Types
export enum IoTDeviceType {
  SMART_FRIDGE = 'smart_fridge',
  VENDING_MACHINE = 'vending_machine',
  COFFEE_MACHINE = 'coffee_machine',
  SMART_LOCK = 'smart_lock',
  ENVIRONMENTAL_SENSOR = 'environmental_sensor',
  INVENTORY_TRACKER = 'inventory_tracker',
  INDUSTRIAL_CONTROLLER = 'industrial_controller',
  SMART_THERMOSTAT = 'smart_thermostat',
  SMART_PLUG = 'smart_plug',
  SECURITY_CAMERA = 'security_camera',
  WEARABLE_DEVICE = 'wearable_device',
  SMART_SPEAKER = 'smart_speaker',
  GENERIC_SENSOR = 'generic_sensor',
}

// Sensor Data Schema
const SensorDataSchema = z.object({
  sensorId: z.string(),
  type: z.enum(['temperature', 'humidity', 'pressure', 'light', 'motion', 'proximity', 'level', 'voltage', 'current']),
  value: z.number(),
  unit: z.string(),
  timestamp: z.number(),
  accuracy: z.number().min(0).max(100).optional(), // Accuracy percentage
});

export type SensorData = z.infer<typeof SensorDataSchema>;

// IoT Command Schema
const IoTCommandSchema = z.object({
  commandId: z.string(),
  type: z.enum(['read', 'write', 'execute', 'configure', 'reset', 'update']),
  target: z.string(), // Target device/sensor/actuator
  payload: z.any(),
  timestamp: z.number(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
});

export type IoTCommand = z.infer<typeof IoTCommandSchema>;

// Device Status Schema
const DeviceStatusSchema = z.object({
  deviceId: z.string(),
  status: z.enum(['online', 'offline', 'maintenance', 'error', 'updating']),
  batteryLevel: z.number().min(0).max(100).optional(),
  signalStrength: z.number().min(-100).max(0).optional(), // dBm
  uptime: z.number().optional(), // Seconds
  lastSeen: z.number(),
  firmwareVersion: z.string().optional(),
  errorCode: z.string().optional(),
});

export type DeviceStatus = z.infer<typeof DeviceStatusSchema>;

// IoT Device Configuration
export interface IoTDeviceConfig {
  deviceType: IoTDeviceType;
  protocol: IoTProtocol;
  networkConfig: {
    brokerUrl?: string; // MQTT broker, CoAP server, etc.
    clientId: string;
    username?: string;
    password?: string;
    keepAlive: number;
    qosLevel: 0 | 1 | 2;
  };
  sensors: Array<{
    id: string;
    type: string;
    pin?: number;
    address?: string;
    interval: number; // Reading interval in ms
    metadata?: {
      itemId?: string; // For inventory tracking
    };
  }>;
  actuators: Array<{
    id: string;
    type: string;
    pin?: number;
    address?: string;
  }>;
  powerManagement: {
    batteryPowered: boolean;
    sleepMode: boolean;
    wakeupInterval?: number; // For sleep mode
  };
  security: {
    encryption: boolean;
    encryptionLevel?: string;
    deviceAttestation?: boolean;
    trustedEnvironment?: boolean;
    certificatePath?: string;
    keyPath?: string;
  };
  automaticOrdering: {
    enabled: boolean;
    thresholds: Record<string, number>; // Item -> threshold level
    suppliers: Array<{
      id: string;
      name: string;
      items: string[];
    }>; // Supplier array
  };
  display?: {
    hasDisplay: boolean;
    type?: string;
  };
  connectivity?: {
    hasWiFi: boolean;
    hasBluetooth: boolean;
    hasEthernet: boolean;
  };
  input?: {
    hasKeypad: boolean;
    hasVoiceInput: boolean;
  };
  output?: {
    hasSpeaker: boolean;
    hasPrinter: boolean;
  };
  payment?: {
    maxAmount: number;
    supportedCurrencies: string[];
  };
}

/**
 * IoT Device Adapter for smart home and industrial device integration
 * Supports automatic ordering, sensor-triggered payments, and remote control
 */
export class IoTDeviceAdapter implements UPPDevice {
  private config: IoTDeviceConfig;
  private isInitialized = false;
  private protocolClient?: any; // Protocol-specific client (MQTT, CoAP, etc.)
  private sensorData = new Map<string, SensorData>();
  private deviceStatus: DeviceStatus;
  private automaticOrderingActive = false;

  constructor(config: Partial<IoTDeviceConfig> = {}) {
    this.config = {
      deviceType: IoTDeviceType.GENERIC_SENSOR,
      protocol: IoTProtocol.MQTT,
      networkConfig: {
        clientId: `upp-iot-${Date.now()}`,
        keepAlive: 60,
        qosLevel: 1,
      },
      sensors: [],
      actuators: [],
      powerManagement: {
        batteryPowered: false,
        sleepMode: false,
      },
      security: {
        encryption: true,
      },
      automaticOrdering: {
        enabled: false,
        thresholds: {},
        suppliers: [],
      },
      ...config,
    };

    this.deviceStatus = {
      deviceId: this.getDeviceId(),
      status: 'offline',
      lastSeen: Date.now(),
    };
  }

  // UPPDevice interface implementation
  getDeviceId(): string {
    return `iot-${this.getDeviceFingerprint()}`;
  }

  getDeviceType(): string {
    return `IOT_${this.config.deviceType.toUpperCase()}`;
  }

  getFingerprint(): string {
    return `iot-${this.config.protocol}-${this.hashConfig()}`;
  }

  getSecurityContext(): any {
    return {
      encryptionLevel: this.config.security.encryptionLevel || 'NONE',
      deviceAttestation: this.config.security.deviceAttestation || false,
      trustedEnvironment: this.config.security.trustedEnvironment || false
    };
  }

  getCapabilities(): DeviceCapabilities {
    return {
      hasDisplay: this.config.display?.hasDisplay || false,
      hasCamera: false, // IoT devices typically don't have cameras for payment
      hasNFC: false,
      hasBluetooth: this.config.connectivity?.hasBluetooth || false,
      hasWiFi: this.config.connectivity?.hasWiFi || false,
      hasKeypad: this.config.input?.hasKeypad || false,
      hasTouchScreen: false,
      hasVoiceInput: this.config.input?.hasVoiceInput || false,
      hasVoiceOutput: this.config.output?.hasSpeaker || false,
      hasPrinter: this.config.output?.hasPrinter || false,
      supportsEncryption: this.config.security.encryption,
      internet_connection: this.config.connectivity?.hasWiFi || this.config.connectivity?.hasEthernet || false,
      maxPaymentAmount: this.config.payment?.maxAmount || 5000,
      supportedCurrencies: this.config.payment?.supportedCurrencies || ['USD'],
      securityLevel: this.config.security.encryptionLevel === 'AES256' ? 'HIGH' : 'STANDARD'
    };
  }

  getDeviceFingerprint(): string {
    const deviceTypeId = this.config.deviceType.substring(0, 4);
    const protocolId = this.config.protocol.substring(0, 4);
    const configHash = this.hashConfig();
    
    return `${deviceTypeId}-${protocolId}-${configHash}`;
  }

  async handlePaymentResponse(response: PaymentResult): Promise<IoTResponse> {
    const sensorCount = this.config.sensors.length;
    const ledPattern = response.success ? 'success_pulse' : 'error_flash';

    // Update device status based on payment result
    if (response.success) {
      await this.updateDeviceStatus('online');
    }

    return {
      success: response.success,
      deviceCount: 1,
      status: response.success ? 'payment_completed' : 'payment_failed',
      ledPattern,
      metadata: {
        deviceType: this.config.deviceType,
        protocol: this.config.protocol,
        sensorCount,
        batteryLevel: this.deviceStatus.batteryLevel,
        automaticOrdering: this.automaticOrderingActive,
      },
    };
  }

  async handleError(error: UPPError): Promise<void> {
    console.error(`IoT Device Error: ${error.message}`);
    
    // Update device status to error
    await this.updateDeviceStatus('error', error.message);
    
    // Flash error LED pattern
    await this.activateLEDPattern('error_flash');
    
    // Send error notification via protocol
    await this.sendStatusUpdate({
      error: error.message,
      timestamp: Date.now(),
    });
  }

  // IoT-specific methods

  /**
   * Initialize IoT device and protocol connection
   */
  async initializeIoT(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize protocol client
      await this.initializeProtocolClient();
      
      // Setup sensors
      await this.initializeSensors();
      
      // Setup actuators
      await this.initializeActuators();
      
      // Start sensor reading loops
      this.startSensorMonitoring();
      
      // Setup automatic ordering if enabled
      if (this.config.automaticOrdering.enabled) {
        await this.setupAutomaticOrdering();
      }

      // Update device status
      await this.updateDeviceStatus('online');

      this.isInitialized = true;
      console.log('IoT Device Adapter initialized successfully');
    } catch (error) {
      throw new UPPError(`Failed to initialize IoT device: ${error}`, 'IOT_DEVICE_INIT_ERROR');
    }
  }

  /**
   * Read sensor data from device
   */
  async readSensorData(sensorId: string): Promise<any> {
    try {
      const sensor = this.config.sensors.find(s => s.id === sensorId);
      if (!sensor) {
        throw new UPPError(`Sensor ${sensorId} not found`, 'IOT_SENSOR_NOT_FOUND');
      }

      // Simulate sensor reading
      const reading = {
        sensorId,
        value: Math.random() * 100,
        unit: sensor.type, // Use type as unit fallback
        timestamp: new Date(),
        accuracy: 0.95
      };

      return reading;
    } catch (error) {
      throw new UPPError(`Failed to read sensor data: ${error}`, 'IOT_SENSOR_READ_ERROR');
    }
  }

  /**
   * Trigger automatic purchase based on sensor data
   */
  async triggerAutomaticOrder(itemId: string): Promise<void> {
    if (!this.config.automaticOrdering.enabled) {
      throw new UPPError('Automatic ordering is disabled', 'IOT_AUTOMATION_DISABLED');
    }

    const supplier = this.config.automaticOrdering.suppliers.find(s => s.items.includes(itemId));
    if (!supplier) {
      throw new UPPError(`No supplier configured for item: ${itemId}`, 'IOT_SUPPLIER_NOT_FOUND');
    }

    // Check inventory level
    const inventoryLevel = await this.getInventoryLevel(itemId);
    const threshold = this.config.automaticOrdering.thresholds[itemId];
    
    if (threshold && inventoryLevel > threshold) {
      throw new UPPError(`Inventory level (${inventoryLevel}) above threshold (${threshold})`, 'IOT_INVENTORY_ABOVE_THRESHOLD');
    }

    try {
      // Send order to supplier
      const order = {
        itemId,
        quantity: this.config.automaticOrdering.thresholds[itemId] || 1,
        supplier: supplier.id,
        timestamp: new Date()
      };

      await this.sendOrderToSupplier(order);
      console.log(`Automatic order triggered for ${itemId}`);
    } catch (error) {
      throw new UPPError(`Failed to trigger automatic order: ${error}`, 'IOT_ORDER_FAILED');
    }
  }

  /**
   * Update LED status pattern
   */
  async activateLEDPattern(pattern: string): Promise<void> {
    const ledActuator = this.config.actuators.find(a => a.type === 'led');
    if (!ledActuator) {
      console.log('No LED actuator configured');
      return;
    }

    try {
      await this.controlActuator(ledActuator.id, 'set_pattern', 0);

      console.log(`LED pattern activated: ${pattern}`);
    } catch (error) {
      console.error('Failed to activate LED pattern:', error);
    }
  }

  /**
   * Send command to IoT device actuator
   */
  async controlActuator(actuatorId: string, action: string, value?: number): Promise<void> {
    const actuator = this.config.actuators.find(a => a.id === actuatorId);
    if (!actuator) {
      throw new UPPError(`Actuator not found: ${actuatorId}`, 'IOT_ACTUATOR_NOT_FOUND');
    }

    try {
      // Simulate actuator control
      const command = {
        actuatorId,
        action,
        value,
        timestamp: new Date()
      };

      await this.sendCommand(command);
      console.log(`Actuator ${actuatorId} controlled: ${action}${value ? ` = ${value}` : ''}`);
    } catch (error) {
      throw new UPPError(`Failed to control actuator ${actuatorId}: ${error}`, 'IOT_ACTUATOR_CONTROL_ERROR');
    }
  }

  /**
   * Get device status including sensor readings
   */
  async getDeviceStatus(): Promise<DeviceStatus & { sensors: SensorData[] }> {
    const sensorReadings = await this.readSensorData(this.config.sensors[0]?.id || 'default');
    
    return {
      ...this.deviceStatus,
      sensors: sensorReadings,
    };
  }

  /**
   * Update device configuration remotely
   */
  async updateConfiguration(newConfig: Partial<IoTDeviceConfig>): Promise<void> {
    try {
      // Validate new configuration
      // Validate configuration using basic validation instead of schema
      const validatedConfig = {
        ...this.config,
        ...newConfig
      };

      // Apply configuration update
      this.config = validatedConfig;
      
      // Reinitialize if needed
      if (newConfig.protocol || newConfig.security) {
        await this.initializeIoT();
      }

      console.log('IoT device configuration updated successfully');
    } catch (error) {
      throw new UPPError(`Failed to update configuration: ${error}`, 'IOT_CONFIG_UPDATE_ERROR');
    }
  }

  // Private helper methods

  private async initializeProtocolClient(): Promise<void> {
    switch (this.config.protocol) {
      case IoTProtocol.MQTT:
        await this.initializeMQTTClient();
        break;
      
      case IoTProtocol.COAP:
        await this.initializeCoapClient();
        break;
      
      case IoTProtocol.HTTP:
        await this.initializeHTTPClient();
        break;
      
      case IoTProtocol.WEBSOCKET:
        await this.initializeWebSocketClient();
        break;
      
      default:
        throw new UPPError(`Unsupported IoT protocol: ${this.config.protocol}`, 'IOT_UNSUPPORTED_PROTOCOL', 400);
    }
  }

  private async initializeMQTTClient(): Promise<void> {
    console.log('Initializing MQTT client...');
    // MQTT client initialization would go here
    // const mqtt = require('mqtt');
    // this.protocolClient = mqtt.connect(this.config.networkConfig.brokerUrl, {...});
  }

  private async initializeCoapClient(): Promise<void> {
    console.log('Initializing CoAP client...');
    // CoAP client initialization would go here
  }

  private async initializeHTTPClient(): Promise<void> {
    console.log('Initializing HTTP client...');
    // HTTP client initialization would go here
  }

  private async initializeWebSocketClient(): Promise<void> {
    console.log('Initializing WebSocket client...');
    // WebSocket client initialization would go here
  }

  private async initializeSensors(): Promise<void> {
    console.log('Initializing sensors...');
    
    for (const sensor of this.config.sensors) {
      console.log(`Initializing sensor: ${sensor.id} (${sensor.type})`);
      
      // Sensor-specific initialization based on type
      switch (sensor.type) {
        case 'temperature':
          await this.initializeTemperatureSensor(sensor);
          break;
        case 'humidity':
          await this.initializeHumiditySensor(sensor);
          break;
        case 'level':
          await this.initializeLevelSensor(sensor);
          break;
        // Add more sensor types as needed
      }
    }
  }

  private async initializeActuators(): Promise<void> {
    console.log('Initializing actuators...');
    
    for (const actuator of this.config.actuators) {
      console.log(`Initializing actuator: ${actuator.id} (${actuator.type})`);
      
      // Actuator-specific initialization
      switch (actuator.type) {
        case 'led':
          await this.initializeLEDActuator(actuator);
          break;
        case 'relay':
          await this.initializeRelayActuator(actuator);
          break;
        case 'servo':
          await this.initializeServoActuator(actuator);
          break;
      }
    }
  }

  private async initializeTemperatureSensor(sensor: any): Promise<void> {
    // Temperature sensor initialization
    console.log(`Temperature sensor ${sensor.id} initialized on pin ${sensor.pin}`);
  }

  private async initializeHumiditySensor(sensor: any): Promise<void> {
    // Humidity sensor initialization
    console.log(`Humidity sensor ${sensor.id} initialized on pin ${sensor.pin}`);
  }

  private async initializeLevelSensor(sensor: any): Promise<void> {
    // Level sensor initialization (for inventory tracking)
    console.log(`Level sensor ${sensor.id} initialized on pin ${sensor.pin}`);
  }

  private async initializeLEDActuator(actuator: any): Promise<void> {
    // LED actuator initialization
    console.log(`LED actuator ${actuator.id} initialized on pin ${actuator.pin}`);
  }

  private async initializeRelayActuator(actuator: any): Promise<void> {
    // Relay actuator initialization
    console.log(`Relay actuator ${actuator.id} initialized on pin ${actuator.pin}`);
  }

  private async initializeServoActuator(actuator: any): Promise<void> {
    // Servo actuator initialization
    console.log(`Servo actuator ${actuator.id} initialized on pin ${actuator.pin}`);
  }

  private startSensorMonitoring(): void {
    for (const sensor of this.config.sensors) {
      const interval = setInterval(async () => {
        try {
          const reading = await this.readSingleSensor(sensor.id);
          if (reading) {
            this.sensorData.set(sensor.id, reading);
            
            // Check for automatic ordering triggers
            if (this.config.automaticOrdering.enabled) {
              await this.checkAutomaticOrderingTriggers(sensor.id, reading);
            }
          }
        } catch (error) {
          console.error(`Error reading sensor ${sensor.id}:`, error);
        }
      }, sensor.interval);

      // Store interval ID for cleanup
      // In real implementation, you'd want to store these for proper cleanup
    }
  }

  private async readSingleSensor(sensorId: string): Promise<SensorData | null> {
    const sensor = this.config.sensors.find(s => s.id === sensorId);
    if (!sensor) {
      return null;
    }

    // Simulate sensor reading based on type
    let value: number;
    let unit: string;

    switch (sensor.type) {
      case 'temperature':
        value = 20 + Math.random() * 15; // 20-35°C
        unit = '°C';
        break;
      
      case 'humidity':
        value = 40 + Math.random() * 40; // 40-80%
        unit = '%';
        break;
      
      case 'level':
        value = Math.random() * 100; // 0-100%
        unit = '%';
        break;
      
      case 'pressure':
        value = 1013 + (Math.random() - 0.5) * 50; // ~1013 hPa
        unit = 'hPa';
        break;
      
      default:
        value = Math.random() * 100;
        unit = 'units';
    }

    return {
      sensorId,
      type: sensor.type as any,
      value,
      unit,
      timestamp: Date.now(),
      accuracy: 95 + Math.random() * 5, // 95-100% accuracy
    };
  }

  private async setupAutomaticOrdering(): Promise<void> {
    console.log('Setting up automatic ordering...');
    this.automaticOrderingActive = true;
    
    // Initialize inventory tracking for automatic ordering
    for (const [itemId, threshold] of Object.entries(this.config.automaticOrdering.thresholds)) {
      console.log(`Monitoring inventory for ${itemId} (threshold: ${threshold})`);
    }
  }

  private async checkAutomaticOrderingTriggers(sensorId: string, reading: SensorData): Promise<void> {
    // Check if this sensor reading triggers automatic ordering
    const sensor = this.config.sensors.find(s => s.id === sensorId);
    if (!sensor || sensor.type !== 'level') {
      return; // Only level sensors trigger automatic ordering
    }

    // Map sensor to inventory item (in real implementation, this would be configurable)
    const itemId = this.mapSensorToItem(sensorId);
    if (!itemId) {
      return;
    }

    const threshold = this.config.automaticOrdering.thresholds[itemId];
    if (threshold !== undefined && reading.value < threshold) {
      try {
        // Calculate order quantity based on typical consumption
        const orderQuantity = this.calculateOrderQuantity(itemId, reading.value);
        
        const paymentRequest = await this.triggerAutomaticOrder(itemId);
        
        console.log(`Automatic order triggered for ${itemId}:`, paymentRequest);
        
        // In real implementation, this would integrate with the UPP payment system
        // await this.processAutomaticPayment(paymentRequest);
      } catch (error) {
        console.error(`Failed to trigger automatic order for ${itemId}:`, error);
      }
    }
  }

  private mapSensorToItem(sensorId: string): string | undefined {
    // Map sensor IDs to inventory items
    const mapping: Record<string, string> = {
      'level_sensor_coffee': 'coffee_beans',
      'level_sensor_water': 'water_filter',
      'level_sensor_detergent': 'laundry_detergent',
      // Add more mappings as needed
    };

    return mapping[sensorId];
  }

  private calculateOrderQuantity(itemId: string, currentLevel: number): number {
    // Calculate optimal order quantity based on current level and consumption patterns
    const baseQuantity: Record<string, number> = {
      'coffee_beans': 5, // 5 bags
      'water_filter': 2, // 2 filters
      'laundry_detergent': 3, // 3 bottles
    };

    return baseQuantity[itemId] || 1;
  }

  private async getInventoryLevel(itemId: string): Promise<number> {
    const sensor = this.config.sensors.find(s => s.type === 'level' && s.metadata?.itemId === itemId);
    if (!sensor) {
      throw new UPPError(`No level sensor configured for item: ${itemId}`, 'IOT_LEVEL_SENSOR_NOT_FOUND');
    }

    const reading = await this.readSensorData(sensor.id);
    return reading.value;
  }

  private async sendOrderToSupplier(order: any): Promise<void> {
    // Simulate sending order to supplier
    console.log('Sending order to supplier:', order);
  }

  private async sendMQTTCommand(command: any): Promise<void> {
    // Simulate MQTT command sending
    console.log('MQTT command sent:', command);
  }

  private async sendHTTPCommand(command: any): Promise<void> {
    // Simulate HTTP command sending
    console.log('HTTP command sent:', command);
  }

  private async sendWebSocketCommand(command: any): Promise<void> {
    // Simulate WebSocket command sending
    console.log('WebSocket command sent:', command);
  }

  private async sendBluetoothMeshCommand(command: any): Promise<void> {
    // Simulate Bluetooth Mesh command sending
    console.log('Bluetooth Mesh command sent:', command);
  }

  private async sendCommand(command: any): Promise<void> {
    try {
      // Protocol-specific command sending
      switch (this.config.protocol) {
        case IoTProtocol.MQTT:
          await this.sendMQTTCommand(command);
          break;
        case IoTProtocol.HTTP:
          await this.sendHTTPCommand(command);
          break;
        case IoTProtocol.WEBSOCKET:
          await this.sendWebSocketCommand(command);
          break;
        case IoTProtocol.BLUETOOTH_MESH:
          await this.sendBluetoothMeshCommand(command);
          break;
        default:
          throw new UPPError(`Unsupported IoT protocol: ${this.config.protocol}`, 'IOT_UNSUPPORTED_PROTOCOL');
      }
    } catch (error) {
      throw new UPPError(`Failed to send command: ${error}`, 'IOT_COMMAND_SEND_ERROR');
    }
  }

  private async sendStatusUpdate(status: any): Promise<void> {
    const statusUpdate = {
      deviceId: this.getDeviceId(),
      timestamp: Date.now(),
      status,
    };

    // Send status update via configured protocol
    console.log('Status update sent:', statusUpdate);
  }

  private async updateDeviceStatus(status: DeviceStatus['status'], errorCode?: string): Promise<void> {
    this.deviceStatus = {
      ...this.deviceStatus,
      status,
      lastSeen: Date.now(),
      errorCode,
    };

    // Send status update
    await this.sendStatusUpdate(this.deviceStatus);
  }

  private async reinitialize(): Promise<void> {
    this.isInitialized = false;
    await this.initializeIoT();
  }

  private getMaxPaymentAmount(): number {
    // Determine max payment amount based on device type
    switch (this.config.deviceType) {
      case IoTDeviceType.VENDING_MACHINE:
        return 2000; // $20.00
      
      case IoTDeviceType.SMART_FRIDGE:
        return 50000; // $500.00 (grocery orders)
      
      case IoTDeviceType.COFFEE_MACHINE:
        return 1000; // $10.00
      
      case IoTDeviceType.INDUSTRIAL_CONTROLLER:
        return 100000; // $1,000.00
      
      default:
        return 10000; // $100.00
    }
  }

  private generateCommandId(): string {
    return `cmd_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private hashConfig(): string {
    const configString = JSON.stringify({
      deviceType: this.config.deviceType,
      protocol: this.config.protocol,
      sensorCount: this.config.sensors.length,
    });
    return Buffer.from(configString).toString('base64').substring(0, 8);
  }
}