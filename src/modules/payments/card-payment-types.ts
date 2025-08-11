// Card Payment Types for Universal Payment Protocol
// Comprehensive card payment processing interfaces

export interface CardPaymentRequest {
  // Basic payment info
  amount: number;
  currency: string;
  description: string;
  merchant_id: string;
  
  // Card information (encrypted)
  card_data: EncryptedCardData;
  
  // Customer information
  customer?: CustomerInfo;
  
  // Transaction metadata
  metadata?: Record<string, any>;
  
  // Location data
  location?: {
    lat?: number;
    lng?: number;
    address?: string;
    ip_address?: string;
  };
  
  // Device information
  device_info?: DeviceInfo;
  
  // Security context
  security_context?: SecurityContext;
}

export interface EncryptedCardData {
  // Encrypted card number (last 4 digits visible)
  card_number: string; // Format: "**** **** **** 1234"
  encrypted_full_number: string; // AES encrypted full card number
  
  // Card details
  expiry_month: number;
  expiry_year: number;
  cvv?: string; // Optional, depends on transaction type
  
  // Card type detection
  card_type?: CardType;
  card_brand?: CardBrand;
  
  // Billing information
  billing_address?: BillingAddress;
  
  // Encryption metadata
  encryption_version: string;
  encrypted_at: string;
}

export interface CustomerInfo {
  email?: string;
  phone?: string;
  name?: {
    first: string;
    last: string;
  };
  customer_id?: string;
  save_card?: boolean;
}

export interface BillingAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export interface DeviceInfo {
  device_type: string;
  device_id: string;
  capabilities: DeviceCapabilities;
  fingerprint: string;
  user_agent?: string;
}

export interface SecurityContext {
  encryption_level: string;
  device_attestation?: string;
  user_authentication?: string;
  trusted_environment?: boolean;
  pci_compliant: boolean;
}

export interface CardPaymentResult {
  success: boolean;
  transaction_id: string;
  payment_intent_id?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  
  // Card-specific information
  card_info?: {
    last4: string;
    brand: CardBrand;
    type: CardType;
    country?: string;
  };
  
  // Authorization details
  authorization?: {
    auth_code: string;
    avs_result: AVSResult;
    cvv_result: CVVResult;
    risk_score?: number;
  };
  
  // Error information
  error_message?: string;
  error_code?: string;
  
  // Receipt data
  receipt_data?: ReceiptData;
  
  // Timestamps
  created_at: string;
  processed_at: string;
}

export interface ReceiptData {
  transaction_id: string;
  amount: number;
  currency: string;
  description: string;
  merchant_id: string;
  card_last4: string;
  card_brand: CardBrand;
  timestamp: string;
  location?: {
    lat?: number;
    lng?: number;
    address?: string;
  };
  device_type: string;
  hawaii_processed: boolean;
}

export type PaymentStatus = 
  | 'pending'
  | 'processing'
  | 'authorized'
  | 'completed'
  | 'failed'
  | 'declined'
  | 'cancelled'
  | 'refunded'
  | 'disputed';

export type CardType = 
  | 'credit'
  | 'debit'
  | 'prepaid'
  | 'unknown';

export type CardBrand = 
  | 'visa'
  | 'mastercard'
  | 'amex'
  | 'discover'
  | 'jcb'
  | 'unionpay'
  | 'unknown';

export interface AVSResult {
  code: string;
  message: string;
  match: boolean;
}

export interface CVVResult {
  code: string;
  message: string;
  match: boolean;
}

export interface DeviceCapabilities {
  internet_connection: boolean;
  display?: 'none' | 'minimal' | 'standard' | 'large' | 'touchscreen';
  input_methods?: string[];
  nfc?: boolean;
  camera?: boolean;
  microphone?: boolean;
  biometric?: boolean;
  gps?: boolean;
  vibration?: boolean;
  push_notifications?: boolean;
  sensors?: boolean;
  [key: string]: any;
}

// Card validation interfaces
export interface CardValidationResult {
  valid: boolean;
  errors: CardValidationError[];
  warnings: CardValidationWarning[];
  card_info?: {
    brand: CardBrand;
    type: CardType;
    country?: string;
    bank?: string;
  };
}

export interface CardValidationError {
  field: string;
  code: string;
  message: string;
  severity: 'error' | 'critical';
}

export interface CardValidationWarning {
  field: string;
  code: string;
  message: string;
  severity: 'warning';
}

// Card processing configuration
export interface CardProcessingConfig {
  // Payment gateway settings
  gateway: {
    provider: 'stripe' | 'square' | 'paypal' | 'adyen';
    api_key: string;
    webhook_secret?: string;
    environment: 'test' | 'live';
  };
  
  // Security settings
  security: {
    encryption_key: string;
    pci_compliance: boolean;
    tokenization_enabled: boolean;
    cvv_required: boolean;
    avs_required: boolean;
  };
  
  // Processing settings
  processing: {
    auto_capture: boolean;
    capture_delay_hours?: number;
    currency_default: string;
    supported_currencies: string[];
    max_amount: number;
    min_amount: number;
  };
  
  // Fraud detection
  fraud_detection: {
    enabled: boolean;
    risk_threshold: number;
    avs_strict: boolean;
    cvv_strict: boolean;
  };
}

// Card input methods for different devices
export interface CardInputMethod {
  type: 'swipe' | 'insert' | 'tap' | 'manual' | 'camera' | 'voice';
  device_type: string;
  encrypted_data: string;
  metadata?: Record<string, any>;
}

// Card token for recurring payments
export interface CardToken {
  token_id: string;
  customer_id: string;
  card_last4: string;
  card_brand: CardBrand;
  card_type: CardType;
  expiry_month: number;
  expiry_year: number;
  billing_address?: BillingAddress;
  created_at: string;
  is_default: boolean;
}
