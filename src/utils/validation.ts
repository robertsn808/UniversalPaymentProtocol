// Input validation utilities for UPP
import { z } from 'zod';

// Payment request validation schema - matches PaymentRequest interface
export const PaymentRequestSchema = z.object({
  amount: z.number().positive('Amount must be greater than 0'),
  currency: z.string().min(3, 'Currency is required').max(3, 'Currency must be 3 characters').regex(/^[A-Z]{3}$/, 'Currency must be uppercase 3-letter code'),
  description: z.string().optional(),
  merchantId: z.string().optional(),
  location: z.object({
    lat: z.number().optional(),
    lng: z.number().optional(),
    address: z.string().optional()
  }).optional(),
  metadata: z.record(z.string(), z.any()).optional()
});

// Device payment request validation schema - for device-specific payments
export const DevicePaymentRequestSchema = z.object({
  amount: z.number().positive('Amount must be greater than 0'),
  deviceType: z.string().min(1, 'Device type is required'),
  deviceId: z.string().min(1, 'Device ID is required'),
  description: z.string().min(1, 'Description is required'),
  customerEmail: z.string().email().optional(),
  metadata: z.record(z.string(), z.any()).optional()
});

// Device registration validation schema
export const DeviceRegistrationSchema = z.object({
  deviceType: z.string().min(1, 'Device type is required'),
  capabilities: z.object({
    internet_connection: z.boolean(),
    display: z.enum(['none', 'minimal', 'standard', 'large', 'touchscreen']).optional(),
    input_methods: z.array(z.string()).optional(),
    nfc: z.boolean().optional(),
    camera: z.boolean().optional(),
    microphone: z.boolean().optional(),
    biometric: z.boolean().optional(),
    gps: z.boolean().optional(),
    vibration: z.boolean().optional(),
    push_notifications: z.boolean().optional()
  }),
  fingerprint: z.string().min(1, 'Device fingerprint is required'),
  securityContext: z.object({
    encryption_level: z.string().min(1, 'Encryption level is required'),
    device_attestation: z.string().optional(),
    user_authentication: z.string().optional(),
    trusted_environment: z.boolean().optional()
  }).optional()
});

// Validation helper function
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: string[] } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.issues.map(err => `${err.path.join('.')}: ${err.message}`);
      return { success: false, errors };
    }
    return { success: false, errors: ['Validation failed'] };
  }
}

// Common validation patterns
export const ValidationPatterns = {
  deviceId: /^[a-zA-Z0-9_-]+$/,
  transactionId: /^[a-zA-Z0-9_-]+$/,
  currency: /^[A-Z]{3}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
};

// Sanitization functions
export function sanitizeString(input: string): string {
  return input.trim().replace(/[<>"'&]/g, '');
}

export function sanitizeAmount(amount: number): number {
  return Math.round(amount * 100) / 100; // Round to 2 decimal places
}

export function sanitizeDeviceId(deviceId: string): string {
  return deviceId.replace(/[^a-zA-Z0-9_-]/g, '');
}

// Additional sanitization functions
export function sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function sanitizePhoneNumber(phone: string): string {
  return phone.replace(/[^0-9+]/g, '');
}

// Enhanced validation patterns
export const EnhancedValidationPatterns = {
  ...ValidationPatterns,
  phone: /^\+?[1-9]\d{1,14}$/,
  url: /^https?:\/\/.+/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  ipv4: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  hexColor: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
};

// Validation helper for common types
export function validateEmail(email: string): boolean {
  return ValidationPatterns.email.test(email);
}

export function validateDeviceId(deviceId: string): boolean {
  return ValidationPatterns.deviceId.test(deviceId);
}

export function validateCurrency(currency: string): boolean {
  return ValidationPatterns.currency.test(currency);
}

export function validateAmount(amount: number): boolean {
  return typeof amount === 'number' && amount > 0 && !isNaN(amount);
}

// Advanced validation helpers
export function validateLocation(location: any): boolean {
  if (!location || typeof location !== 'object') return false;
  
  const hasValidLat = typeof location.lat === 'number' && location.lat >= -90 && location.lat <= 90;
  const hasValidLng = typeof location.lng === 'number' && location.lng >= -180 && location.lng <= 180;
  const hasValidAddress = !location.address || typeof location.address === 'string';
  
  return hasValidLat && hasValidLng && hasValidAddress;
}

export function validateCapabilities(capabilities: any): boolean {
  if (!capabilities || typeof capabilities !== 'object') return false;
  
  const required = ['internet_connection'];
  return required.every(key => typeof capabilities[key] === 'boolean');
}

// Error message utilities
export const ValidationMessages = {
  required: (field: string) => `${field} is required`,
  invalid: (field: string) => `${field} is invalid`,
  minLength: (field: string, min: number) => `${field} must be at least ${min} characters`,
  maxLength: (field: string, max: number) => `${field} must be no more than ${max} characters`,
  pattern: (field: string) => `${field} format is invalid`,
  range: (field: string, min: number, max: number) => `${field} must be between ${min} and ${max}`,
  positive: (field: string) => `${field} must be greater than 0`
};

// Schema validation with custom error messages
export function createSchemaWithCustomErrors(schema: z.ZodSchema, customErrors: Record<string, string>) {
  return schema.superRefine((data, ctx) => {
    // Custom validation logic can be added here
  });
}

// Export all validation utilities
export default {
  PaymentRequestSchema,
  DevicePaymentRequestSchema,
  DeviceRegistrationSchema,
  validateInput,
  sanitizeString,
  sanitizeAmount,
  sanitizeDeviceId,
  ValidationPatterns,
  EnhancedValidationPatterns,
  validateEmail,
  validateDeviceId,
  validateCurrency,
  validateAmount,
  validateLocation,
  validateCapabilities,
  ValidationMessages,
  sanitizeMetadata,
  sanitizeEmail,
  sanitizePhoneNumber
};
