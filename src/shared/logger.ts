
import winston from 'winston';
import { env } from '../config/environment.js';

// Custom log levels
const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    security: 4,
    debug: 5
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    security: 'cyan',
    debug: 'blue'
  }
};

// Add colors to winston
winston.addColors(customLevels.colors);

// Custom format for production
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...meta
    });
  })
);

// Custom format for development
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaString}`;
  })
);

// Configure transports
const transports: winston.transport[] = [
  new winston.transports.Console({
    format: env.NODE_ENV === 'production' ? productionFormat : developmentFormat
  })
];

// Add file transport for production
if (env.NODE_ENV === 'production') {
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: productionFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: productionFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  levels: customLevels.levels,
  level: env.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true })
  ),
  transports,
  exitOnError: false
});

// Security-enhanced logger wrapper
class SecureLogger {
  private logger: winston.Logger;

  constructor(logger: winston.Logger) {
    this.logger = logger;
  }

  /**
   * Log error messages
   */
  error(message: string, meta: Record<string, any> = {}): void {
    this.logger.error(message, {
      ...this.sanitizeMeta(meta),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log warning messages
   */
  warn(message: string, meta: Record<string, any> = {}): void {
    this.logger.warn(message, {
      ...this.sanitizeMeta(meta),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log info messages
   */
  info(message: string, meta: Record<string, any> = {}): void {
    this.logger.info(message, {
      ...this.sanitizeMeta(meta),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log HTTP requests
   */
  http(message: string, meta: Record<string, any> = {}): void {
    this.logger.log('http', message, {
      ...this.sanitizeMeta(meta),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log security events with enhanced metadata
   */
  security(message: string, meta: Record<string, any> = {}): void {
    this.logger.log('security', message, {
      ...this.sanitizeMeta(meta),
      timestamp: new Date().toISOString(),
      severity: meta.severity || 'medium',
      category: 'security'
    });
  }

  /**
   * Log debug messages (only in development)
   */
  debug(message: string, meta: Record<string, any> = {}): void {
    if (env.NODE_ENV === 'development') {
      this.logger.debug(message, {
        ...this.sanitizeMeta(meta),
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Log payment-specific events with enhanced security
   */
  payment(message: string, meta: Record<string, any> = {}): void {
    // Remove sensitive payment data
    const sanitizedMeta = this.sanitizePaymentMeta(meta);
    
    this.logger.info(message, {
      ...sanitizedMeta,
      timestamp: new Date().toISOString(),
      category: 'payment'
    });
  }

  /**
   * Log compliance events for audit trail
   */
  compliance(message: string, meta: Record<string, any> = {}): void {
    this.logger.info(message, {
      ...this.sanitizeMeta(meta),
      timestamp: new Date().toISOString(),
      category: 'compliance',
      retention: 'extended' // Mark for extended retention
    });
  }

  /**
   * Log performance metrics
   */
  performance(message: string, meta: Record<string, any> = {}): void {
    this.logger.info(message, {
      ...this.sanitizeMeta(meta),
      timestamp: new Date().toISOString(),
      category: 'performance'
    });
  }

  /**
   * Sanitize metadata to remove sensitive information
   */
  private sanitizeMeta(meta: Record<string, any>): Record<string, any> {
    const sensitiveKeys = [
      'password', 'secret', 'token', 'key', 'authorization',
      'pan', 'cvv', 'card_number', 'ssn', 'credit_card'
    ];

    const sanitized = { ...meta };

    const sanitizeValue = (value: any, key: string): any => {
      if (typeof value === 'string') {
        // Check if key contains sensitive data
        if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
          return '[REDACTED]';
        }
        
        // Check if value looks like a credit card number
        if (/^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}$/.test(value)) {
          return `****-****-****-${value.slice(-4)}`;
        }
        
        // Check if value looks like a token
        if (value.length > 20 && /^[a-zA-Z0-9_-]+$/.test(value)) {
          return `${value.substring(0, 8)}...`;
        }
        
        return value;
      } else if (typeof value === 'object' && value !== null) {
        const sanitizedObj: any = Array.isArray(value) ? [] : {};
        for (const [subKey, subValue] of Object.entries(value)) {
          sanitizedObj[subKey] = sanitizeValue(subValue, subKey);
        }
        return sanitizedObj;
      }
      
      return value;
    };

    for (const [key, value] of Object.entries(sanitized)) {
      sanitized[key] = sanitizeValue(value, key);
    }

    return sanitized;
  }

  /**
   * Enhanced sanitization for payment-specific metadata
   */
  private sanitizePaymentMeta(meta: Record<string, any>): Record<string, any> {
    const sanitized = this.sanitizeMeta(meta);

    // Additional payment-specific sanitization
    if (sanitized.card_data) {
      if (sanitized.card_data.number) {
        sanitized.card_data.number = `****-****-****-${sanitized.card_data.number.slice(-4)}`;
      }
      if (sanitized.card_data.cvv) {
        sanitized.card_data.cvv = '[REDACTED]';
      }
    }

    if (sanitized.bank_account) {
      if (sanitized.bank_account.account_number) {
        sanitized.bank_account.account_number = `****${sanitized.bank_account.account_number.slice(-4)}`;
      }
      if (sanitized.bank_account.routing_number) {
        sanitized.bank_account.routing_number = `****${sanitized.bank_account.routing_number.slice(-4)}`;
      }
    }

    return sanitized;
  }

  /**
   * Create a child logger with additional context
   */
  child(defaultMeta: Record<string, any>): SecureLogger {
    const childLogger = this.logger.child(this.sanitizeMeta(defaultMeta));
    return new SecureLogger(childLogger);
  }

  /**
   * Create a timer for performance logging
   */
  timer(label: string): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.performance(`Timer: ${label}`, { duration, label });
    };
  }

  /**
   * Log with custom level
   */
  log(level: string, message: string, meta: Record<string, any> = {}): void {
    this.logger.log(level, message, {
      ...this.sanitizeMeta(meta),
      timestamp: new Date().toISOString()
    });
  }
}

// Create and export the secure logger instance
const secureLogger = new SecureLogger(logger);

// Handle uncaught exceptions and unhandled rejections
logger.exceptions.handle(
  new winston.transports.File({ filename: 'logs/exceptions.log' })
);

logger.rejections.handle(
  new winston.transports.File({ filename: 'logs/rejections.log' })
);

export default secureLogger;
export { SecureLogger };
