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
  display?: 'none' | 'minimal' | 'standard' | 'large' | 'touchscreen' | 'gaming';
  input_methods?: string[];
  nfc?: boolean;
  camera?: boolean;
  microphone?: boolean;
  biometric?: boolean;
  gps?: boolean;
  vibration?: boolean;
  push_notifications?: boolean;
  sensors?: boolean;
  automated_purchasing?: boolean;
  qr_generator?: boolean;
  speaker?: boolean;
  voice_recognition?: boolean;
  natural_language?: boolean;
  gaming_store?: boolean;
  user_accounts?: boolean;
  [key: string]: any;
}

export interface SecurityContext {
  encryption_level: string;
  device_attestation?: string;
  user_authentication?: string;
  voice_authentication?: boolean;
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
  amount?: number;
  currency?: string;
  status: 'completed' | 'failed' | 'pending' | 'requires_confirmation';
  error_message?: string;
  receipt_data?: any;
  client_secret?: string; // PCI Compliant: For secure client-side confirmation
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
// Universal Payment Protocol Types - Core Type Definitions
// All the interfaces and types we need for the UPP system

import { UPPError } from '../../../utils/errors.js';

export interface UPPDevice {
  // Core device identification
  getDeviceId(): string;
  getDeviceType(): string;
  getCapabilities(): DeviceCapabilities;
  getDeviceFingerprint(): string;
  getFingerprint(): string;
  getSecurityContext(): SecurityContext;
  
  // Required payment handling methods
  handlePaymentResponse(response: PaymentResult): Promise<MobileResponse | IoTResponse | VoiceResponse | TVResponse | GamingResponse>;
  handleError(error: UPPError): Promise<void>;
  
  // Optional methods for interactive devices
  displayPaymentUI?(options: PaymentUIOptions): Promise<void>;
  captureUserInput?(): Promise<UserInput>;
}

export interface DeviceCapabilities {
  hasDisplay: boolean;
  hasCamera: boolean;
  hasNFC: boolean;
  hasBluetooth: boolean;
  hasWiFi: boolean;
  hasKeypad: boolean;
  hasTouchScreen: boolean;
  hasVoiceInput: boolean;
  hasVoiceOutput: boolean;
  hasPrinter: boolean;
  supportsEncryption: boolean;
  internet_connection: boolean;
  maxPaymentAmount: number; // in cents
  supportedCurrencies: string[];
  securityLevel: 'BASIC' | 'STANDARD' | 'HIGH' | 'PCI_LEVEL_1';
}

export interface SecurityContext {
  encryptionLevel: string;
  deviceAttestation?: string;
  userAuthentication?: string;
  voiceAuthentication?: boolean;
  trustedEnvironment?: boolean;
  certificateInfo?: {
    issuer: string;
    validFrom: Date;
    validTo: Date;
  };
}

export interface PaymentRequest {
  amount: number;
  currency: string;
  description?: string;
  merchantId?: string;
  location?: {
    lat?: number;
    lng?: number;
    address?: string;
  };
  metadata?: Record<string, any>;
}

export interface PaymentResult {
  success: boolean;
  transactionId: string;
  amount: number;
  currency: string;
  timestamp?: Date;
  error?: string;
  metadata?: Record<string, any>;
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
  success: boolean;
  message: string;
  displayDuration?: number;
  requiresUserAction?: boolean;
  vibrationPattern?: string;
  notification?: {
    title: string;
    body: string;
    icon?: string;
  };
  metadata?: Record<string, any>;
}

export interface IoTResponse {
  success: boolean;
  deviceCount: number;
  status: string;
  ledPattern?: string;
  displayText?: string;
  beepPattern?: string;
  metadata?: Record<string, any>;
}

export interface VoiceResponse {
  success: boolean;
  message: string;
  audioResponse?: ArrayBuffer;
  shouldEndSession?: boolean;
  metadata?: Record<string, any>;
}

export interface TVResponse {
  success: boolean;
  fullScreenDisplay: boolean;
  displayDuration: number;
  content: {
    title: string;
    message: string;
    amount?: string;
    qrCode?: string;
  };
  audioFeedback?: {
    playSound: boolean;
    soundType: 'success' | 'error' | 'notification';
    volume: number;
  };
  metadata?: Record<string, any>;
}

export interface GamingResponse {
  success: boolean;
  overlayMessage: string;
  hapticPattern?: string;
  achievementUnlocked?: string;
  gameCurrencyAwarded?: number;
  metadata?: Record<string, any>;
}

// Additional types for the UPPDevice interface
export interface PaymentUIOptions {
  amount: number;
  currency: string;
  description?: string;
  theme?: 'light' | 'dark';
  timeout?: number;
}

export interface UserInput {
  type: 'card' | 'mobile' | 'voice' | 'biometric' | 'qr_scan' | 'voice_command' | 'manual_entry' | 'biometric_auth';
  data: Record<string, unknown>;
  timestamp: number;
}
