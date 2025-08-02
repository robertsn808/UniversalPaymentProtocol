// Universal Payment Protocol Types - Kai's Type Definitions
// All the interfaces and types we need for the UPP system

export interface UPPDevice {
  deviceType: string;
  capabilities: DeviceCapabilities;
  securityContext: SecurityContext;
  fingerprint: string;
  
  // Device must implement these methods
  handlePaymentResponse(response: any): Promise<void>;
  handleError(error: any): Promise<void>;
  displayPaymentUI?(options: any): Promise<void>;
  captureUserInput?(): Promise<any>;
}

export interface DeviceCapabilities {
  internet_connection: boolean;
  display?: 'none' | 'minimal' | 'standard' | 'large' | 'touchscreen' | 'small' | 'gaming' | 'automotive';
  input_methods?: string[];
  nfc?: boolean;
  camera?: boolean;
  microphone?: boolean;
  biometric?: boolean;
  gps?: boolean;
  vibration?: boolean;
  push_notifications?: boolean;
  qr_generator?: boolean;
  sensors?: boolean;
  automated_purchasing?: boolean;
  voice_recognition?: boolean;
  natural_language?: boolean;
  speaker?: boolean;
  gaming_store?: boolean;
  user_accounts?: boolean;
  haptic?: boolean;
  heart_rate?: boolean;
  driver_monitoring?: boolean;
  [key: string]: any;
}

export interface SecurityContext {
  encryption_level: string;
  device_attestation?: string;
  user_authentication?: string;
  trusted_environment?: boolean;
}

export interface PaymentRequest {
  amount: number;
  currency: string;
  description: string;
  merchant_id: string;
  location?: {
    lat?: number;
    lng?: number;
    address?: string;
  };
  metadata?: Record<string, any>;
}

export interface PaymentResult {
  success: boolean;
  transaction_id?: string;
  payment_intent_id?: string;
  amount?: number;
  currency?: string;
  status: 'completed' | 'failed' | 'pending';
  error_message?: string;
  receipt_data?: any;
}

export interface Transaction {
  id: string;
  deviceId: string;
  request: PaymentRequest;
  result?: PaymentResult;
  status: 'processing' | 'completed' | 'failed';
  timestamp: Date;
  device: string;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  errors?: string[];
}

export interface UPPConfig {
  paymentGateway: any;
  security: {
    encryption_key: string;
    certificate_path?: string;
  };
  discovery: {
    enabled: boolean;
    scan_interval: number;
  };
}

// Translator interfaces
export interface InputParser {
  parse(input: any, capabilities: DeviceCapabilities): Promise<PaymentRequest>;
}

export interface OutputFormatter {
  format(result: PaymentResult, device: UPPDevice): Promise<any>;
  formatError(error: Error, device: UPPDevice): Promise<any>;
}

export interface DeviceAdapter {
  deviceType: string;
  canHandle(device: any): boolean;
  createDevice(deviceInfo: any): UPPDevice;
}

// Device-specific response types
export interface MobileResponse {
  type: 'mobile_response';
  success: boolean;
  message: string;
  transaction_id?: string;
  amount?: number;
  receipt?: any;
  vibration?: string;
  notification?: {
    title: string;
    body: string;
    icon: string;
  };
}

export interface IoTResponse {
  type: 'iot_response';
  led_pattern?: string;
  display_text?: string;
  beep_pattern?: string;
  status_code: number;
}

export interface VoiceResponse {
  type: 'voice_response';
  speech: string;
  display_text?: string;
  should_speak: boolean;
}

export interface TVResponse {
  type: 'tv_response';
  full_screen_message: {
    title: string;
    subtitle: string;
    background_color: string;
    display_duration: number;
  };
  sound_effect?: string;
}
