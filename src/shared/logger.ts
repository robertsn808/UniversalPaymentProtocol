
// Secure Logging Infrastructure
import winston from 'winston';

import { env, getSanitizedConfig } from '../config/environment.js';

// Sensitive data patterns to redact from logs
const SENSITIVE_PATTERNS = [
  // Stripe keys
  /sk_live_[a-zA-Z0-9]{99,}/g,
  /sk_test_[a-zA-Z0-9]{99,}/g,
  /pk_live_[a-zA-Z0-9]{99,}/g,
  /pk_test_[a-zA-Z0-9]{99,}/g,
  
  // Credit card numbers (basic pattern)
  /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  
  // Email patterns (for PII protection)
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  
  // Phone numbers (basic pattern)
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
  
  // SSN pattern
  /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g,
  
  // JWT tokens
  /eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g,
  
  // Database passwords
  /password[^&\s]*=[^&\s]*/gi,
  /pwd[^&\s]*=[^&\s]*/gi,
];

// Custom format to sanitize sensitive data
const sanitizeFormat = winston.format((info) => {
  let message = typeof info.message === 'string' ? info.message : JSON.stringify(info.message);
  
  // Redact sensitive patterns
  SENSITIVE_PATTERNS.forEach(pattern => {
    message = message.replace(pattern, '[REDACTED]');
  });
  
  // Sanitize metadata objects
  if (info.metadata && typeof info.metadata === 'object') {
    info.metadata = sanitizeObject(info.metadata);
  }
  
  info.message = message;
  return info;
});

// Safely sanitize objects with depth limit
const sanitizeObject = (obj: any, depth = 0, maxDepth = 3): any => {
  if (depth > maxDepth || typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  try {
    const sanitized: any = Array.isArray(obj) ? [] : {};
    
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize sensitive keys
      if (['password', 'token', 'secret', 'key', 'authorization', 'stripe_key', 'jwt'].some(
        sensitive => key.toLowerCase().includes(sensitive)
      )) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'string') {
        let sanitizedValue = value;
        SENSITIVE_PATTERNS.forEach(pattern => {
          sanitizedValue = sanitizedValue.replace(pattern, '[REDACTED]');
        });
        sanitized[key] = sanitizedValue;
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeObject(value, depth + 1, maxDepth);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  } catch (error) {
    return '[Error sanitizing object]';
  }
};

// Create the logger instance
const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS'
    }),
    winston.format.errors({ stack: true }),
    sanitizeFormat(),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'universal-payment-protocol',
    version: process.env.npm_package_version || '1.0.0',
    environment: env.NODE_ENV
  },
  transports: [
    // Console transport with colorized output for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
          return `${timestamp} [${service}] ${level}: ${message} ${metaStr}`;
        })
      )
    }),
    
    // File transport (if enabled)
    ...(env.LOG_TO_FILE ? [
      new winston.transports.File({ 
        filename: 'logs/error.log', 
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5
      }),
      new winston.transports.File({ 
        filename: 'logs/combined.log',
        maxsize: 5242880, // 5MB
        maxFiles: 5
      })
    ] : [])
  ],
  
  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' }),
    ...(env.NODE_ENV === 'development' ? [new winston.transports.Console()] : [])
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' }),
    ...(env.NODE_ENV === 'development' ? [new winston.transports.Console()] : [])
  ]
});

// Add correlation ID support
export interface LogMetadata {
  correlationId?: string | undefined;
  userId?: string | undefined;
  deviceId?: string | undefined;
  transactionId?: string | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
  amount?: number | undefined;
  success?: boolean;
  error?: string | undefined;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: string;
  contentLength?: string | undefined;
  contentType?: string | undefined;
  deviceType?: string;
  [key: string]: any;
}

// Enhanced logging methods with metadata support
export const secureLogger = {
  error: (message: string, metadata?: LogMetadata) => {
    logger.error(message, sanitizeObject(metadata));
  },
  
  warn: (message: string, metadata?: LogMetadata) => {
    logger.warn(message, sanitizeObject(metadata));
  },
  
  info: (message: string, metadata?: LogMetadata) => {
    logger.info(message, sanitizeObject(metadata));
  },
  
  http: (message: string, metadata?: LogMetadata) => {
    logger.http(message, sanitizeObject(metadata));
  },
  
  debug: (message: string, metadata?: LogMetadata) => {
    logger.debug(message, sanitizeObject(metadata));
  },
  
  // Security-specific logging
  security: (event: string, metadata?: LogMetadata) => {
    logger.warn(`🔒 SECURITY EVENT: ${event}`, {
      ...sanitizeObject(metadata),
      securityEvent: true,
      timestamp: new Date().toISOString()
    });
  },
  
  // Audit trail logging
  audit: (action: string, metadata?: LogMetadata) => {
    logger.info(`📋 AUDIT: ${action}`, {
      ...sanitizeObject(metadata),
      auditEvent: true,
      timestamp: new Date().toISOString()
    });
  },
  
  // Payment-specific logging (with extra sanitization)
  payment: (message: string, metadata?: LogMetadata) => {
    logger.info(`💳 PAYMENT: ${message}`, {
      ...sanitizeObject(metadata),
      paymentEvent: true
    });
  }
};

// Log startup configuration (sanitized)
secureLogger.info('🚀 Logger initialized', {
  config: getSanitizedConfig(),
  logLevel: env.LOG_LEVEL,
  logToFile: env.LOG_TO_FILE
});

export default secureLogger;

