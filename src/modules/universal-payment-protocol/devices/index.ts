// Real-World Device Integration Adapters
// Export all device adapters for easy importing

export { NFCPaymentAdapter } from './NFCPaymentAdapter.js';
export type { PaymentCardData } from './NFCPaymentAdapter.js';
export { NDEFRecordType, NFCCommandType } from './NFCPaymentAdapter.js';

export { BLEDeviceAdapter } from './BLEDeviceAdapter.js';
export type { BLEDevice, BLEPaymentMessage } from './BLEDeviceAdapter.js';
export {
  UPP_BLE_SERVICE_UUID,
  UPP_PAYMENT_CHARACTERISTIC_UUID,
  UPP_STATUS_CHARACTERISTIC_UUID,
  UPP_NOTIFICATION_CHARACTERISTIC_UUID,
} from './BLEDeviceAdapter.js';

export { WebRTCAdapter } from './WebRTCAdapter.js';
export type { SignalingMessage, DataChannelMessage, PeerConnectionState } from './WebRTCAdapter.js';
export { SignalingMessageType } from './WebRTCAdapter.js';

export { SmartTVAdapter } from './SmartTVAdapter.js';
export type { TVPaymentLayout } from './SmartTVAdapter.js';
export { SmartTVPlatform, RemoteControlInput } from './SmartTVAdapter.js';

export { IoTDeviceAdapter } from './IoTDeviceAdapter.js';
export type { SensorData, IoTCommand, DeviceStatus } from './IoTDeviceAdapter.js';
export { IoTProtocol, IoTDeviceType } from './IoTDeviceAdapter.js';

export { VoiceAssistantAdapter } from './VoiceAssistantAdapter.js';
export type { VoiceCommand, VoiceAuthData } from './VoiceAssistantAdapter.js';
export { VoiceAssistantPlatform, VoiceCommandType } from './VoiceAssistantAdapter.js';

export { GamingControllerAdapter } from './GamingControllerAdapter.js';
export type { GamePurchase, ControllerSequence } from './GamingControllerAdapter.js';
export { GamingPlatform, ControllerInput, GamePurchaseType, HapticPattern } from './GamingControllerAdapter.js';