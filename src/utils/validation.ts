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
  metadata: z.record(z.any()).optional()
});

// Device payment request validation schema - for device-specific payments
export const DevicePaymentRequestSchema = z.object({
  amount: z.number().positive('Amount must be greater than 0'),
  deviceType: z.string().min(1, 'Device type is required'),
  deviceId: z.string().min(1, 'Device ID is required'),
  description: z.string().min(1, 'Description is required'),
  customerEmail: z.string().email().optional(),
  metadata: z.record(z.any()).optional()
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
      const errors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
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