// Security Configuration - Universal Payment Protocol
// Centralized security settings and validation schemas

import { z } from 'zod';

// Environment validation schema
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  
  // Stripe configuration (required)
  STRIPE_SECRET_KEY: z.string().min(1, 'Stripe secret key is required'),
  STRIPE_PUBLISHABLE_KEY: z.string().min(1, 'Stripe publishable key is required'),
  
  // Security settings
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  API_KEY_SECRET: z.string().min(16, 'API key secret must be at least 16 characters'),
  ENCRYPTION_KEY: z.string().min(32, 'Encryption key must be at least 32 characters'),
  
  // Optional settings
  FRONTEND_URL: z.string().url().optional(),
  CORS_ORIGINS: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  
  // Database (future)
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
});

// Request validation schemas
export const deviceRegistrationSchema = z.object({
  deviceType: z.enum([
    'smartphone',
    'smart_tv', 
    'iot_device',
    'voice_assistant',
    'gaming_console',
    'smartwatch',
    'car_system'
  ]),
  fingerprint: z.string().min(1, 'Device fingerprint is required'),
  capabilities: z.record(z.any()).optional(),
  securityContext: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
});

export const paymentProcessingSchema = z.object({
  deviceId: z.string().min(1, 'Device ID is required'),
  amount: z.number().positive('Amount must be positive').max(100000, 'Amount exceeds maximum'),
  currency: z.string().length(3, 'Currency must be 3 characters').default('USD'),
  description: z.string().max(500, 'Description too long').optional(),
  merchantId: z.string().max(100, 'Merchant ID too long').optional(),
  customerEmail: z.string().email('Invalid email format').optional(),
  metadata: z.record(z.any()).optional(),
});

export const biometricAuthSchema = z.object({
  type: z.enum(['fingerprint', 'face', 'voice', 'behavioral']),
  deviceId: z.string().min(1, 'Device ID is required'),
  biometricHash: z.string().min(1, 'Biometric hash is required'),
  confidence: z.number().min(0).max(1, 'Confidence must be between 0 and 1'),
  metadata: z.record(z.any()).optional(),
});

// Security headers configuration
export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
};

// Rate limiting configuration
export const rateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests, please try again later',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
};

// Payment-specific rate limiting (stricter)
export const paymentRateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 payment requests per windowMs
  message: {
    success: false,
    error: 'Too many payment requests, please try again later',
    code: 'PAYMENT_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
};

// Allowed CORS origins
export const getAllowedOrigins = (): string[] => {
  const corsOrigins = process.env.CORS_ORIGINS;
  if (corsOrigins) {
    return corsOrigins.split(',').map(origin => origin.trim());
  }
  
  // Default origins for development
  if (process.env.NODE_ENV === 'development') {
    return [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001'
    ];
  }
  
  return []; // Production should explicitly set CORS_ORIGINS
};

// Input sanitization patterns
export const sanitizationPatterns = {
  // Remove potentially dangerous characters
  removeHtml: /<[^>]*>/g,
  removeScripts: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  removeSQL: /(union|select|insert|update|delete|drop|create|alter|exec|execute)/gi,
  
  // Whitelist patterns
  alphanumeric: /^[a-zA-Z0-9_-]+$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
};

// Security logging configuration
export const securityLogConfig = {
  // Events to log
  events: [
    'authentication_failure',
    'authorization_failure', 
    'rate_limit_exceeded',
    'invalid_request',
    'payment_processing_error',
    'device_registration_failure',
    'suspicious_activity'
  ],
  
  // Log levels
  levels: {
    critical: 'CRITICAL',
    high: 'HIGH',
    medium: 'MEDIUM',
    low: 'LOW',
    info: 'INFO'
  }
};

// JWT configuration
export const jwtConfig = {
  algorithm: 'HS256' as const,
  expiresIn: 3600, // 1 hour in seconds
  issuer: 'upp-server',
  audience: 'upp-client',
};

// API Key configuration
export const apiKeyConfig = {
  keyLength: 32,
  prefix: 'upp_',
  algorithm: 'sha256',
};

// Encryption configuration
export const encryptionConfig = {
  algorithm: 'aes-256-gcm',
  keyLength: 32,
  ivLength: 16,
  tagLength: 16,
};

// Password/PIN requirements
export const passwordRequirements = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  maxAttempts: 5,
  lockoutDuration: 15 * 60 * 1000, // 15 minutes
};

// Session configuration
export const sessionConfig = {
  maxAge: 60 * 60 * 1000, // 1 hour
  secure: process.env.NODE_ENV === 'production',
  httpOnly: true,
  sameSite: 'strict' as const,
};

export type SecurityConfig = {
  env: z.infer<typeof envSchema>;
  headers: typeof securityHeaders;
  rateLimit: typeof rateLimitConfig;
  cors: string[];
  jwt: typeof jwtConfig;
  encryption: typeof encryptionConfig;
};