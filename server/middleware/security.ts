// Security Middleware for UPP Server
// Comprehensive security measures including input sanitization, encryption, and protection

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import validator from 'validator';
import rateLimit from 'express-rate-limit';

export interface SecurityRequest extends Request {
  requestId?: string;
  startTime?: number;
  clientIP?: string;
  fingerprint?: string;
}

export class SecurityMiddleware {
  // Request ID and timing middleware
  static requestTracking = (req: SecurityRequest, res: Response, next: NextFunction): void => {
    req.requestId = crypto.randomUUID();
    req.startTime = Date.now();
    req.clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    
    // Add request ID to response headers
    res.setHeader('X-Request-ID', req.requestId);
    
    next();
  };

  // Input sanitization middleware
  static sanitizeInput = (req: Request, _res: Response, next: NextFunction): void => {
    const sanitizeValue = (value: any): any => {
      if (typeof value === 'string') {
        // Remove potential XSS vectors
        return validator.escape(value.trim());
      } else if (Array.isArray(value)) {
        return value.map(sanitizeValue);
      } else if (value && typeof value === 'object') {
        const sanitized: any = {};
        for (const [key, val] of Object.entries(value)) {
          // Sanitize keys too
          const cleanKey = validator.escape(key);
          sanitized[cleanKey] = sanitizeValue(val);
        }
        return sanitized;
      }
      return value;
    };

    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeValue(req.body);
    }

    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeValue(req.query);
    }

    next();
  };

  // Validate payment amounts and prevent overflow attacks
  static validatePaymentData = (req: Request, res: Response, next: NextFunction): void => {
    if (req.body && req.body.amount !== undefined) {
      const amount = Number(req.body.amount);
      
      // Check for valid number
      if (isNaN(amount) || !isFinite(amount)) {
        res.status(400).json({
          success: false,
          error: 'Invalid amount',
          message: 'Payment amount must be a valid number'
        });
        return;
      }

      // Check for reasonable bounds
      if (amount <= 0) {
        res.status(400).json({
          success: false,
          error: 'Invalid amount',
          message: 'Payment amount must be positive'
        });
        return;
      }

      if (amount > 1000000) { // $1M limit
        res.status(400).json({
          success: false,
          error: 'Amount too large',
          message: 'Payment amount exceeds maximum allowed limit'
        });
        return;
      }

      // Check for precision attacks (more than 2 decimal places)
      const precision = (amount.toString().split('.')[1] || '').length;
      if (precision > 2) {
        res.status(400).json({
          success: false,
          error: 'Invalid precision',
          message: 'Payment amount cannot have more than 2 decimal places'
        });
        return;
      }
    }

    next();
  };

  // Content Security Policy
  static contentSecurityPolicy = (_req: Request, res: Response, next: NextFunction): void => {
    res.setHeader('Content-Security-Policy', 
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "connect-src 'self' https://api.stripe.com; " +
      "frame-ancestors 'none'; " +
      "base-uri 'self';"
    );
    next();
  };

  // HTTPS enforcement
  static enforceHTTPS = (req: Request, res: Response, next: NextFunction): void => {
    if (process.env['NODE_ENV'] === 'production' && !req.secure && req.get('x-forwarded-proto') !== 'https') {
      res.redirect(301, `https://${req.get('host')}${req.url}`);
      return;
    }
    next();
  };

  // Remove sensitive headers and data from responses
  static sanitizeResponse = (_req: Request, res: Response, next: NextFunction): void => {
    // Remove server information
    res.removeHeader('X-Powered-By');
    
    // Override res.json to sanitize sensitive data
    const originalJson = res.json;
    res.json = function(obj: any) {
      const sanitized = SecurityMiddleware.removeSensitiveData(obj);
      return originalJson.call(this, sanitized);
    };

    next();
  };

  // Device fingerprinting for fraud detection
  static deviceFingerprinting = (req: SecurityRequest, _res: Response, next: NextFunction): void => {
    const userAgent = req.get('User-Agent') || '';
    const acceptLanguage = req.get('Accept-Language') || '';
    const acceptEncoding = req.get('Accept-Encoding') || '';
    const ip = req.clientIP || '';

    // Create device fingerprint
    const fingerprintData = `${userAgent}|${acceptLanguage}|${acceptEncoding}|${ip}`;
    req.fingerprint = crypto.createHash('sha256').update(fingerprintData).digest('hex');

    next();
  };

  // Request size limiting
  static requestSizeLimit = (maxSize: number = 1024 * 1024) => { // 1MB default
    return (req: Request, res: Response, next: NextFunction): void => {
      if (req.get('content-length')) {
        const contentLength = parseInt(req.get('content-length') || '0');
        if (contentLength > maxSize) {
          res.status(413).json({
            success: false,
            error: 'Request too large',
            message: `Request size exceeds maximum allowed size of ${maxSize} bytes`
          });
          return;
        }
      }
      next();
    };
  };

  // Remove sensitive data from objects
  private static removeSensitiveData(obj: any): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const sensitiveKeys = [
      'password', 'secret', 'key', 'token', 'apiKey', 'stripe',
      'creditCard', 'ssn', 'sin', 'passport', 'license'
    ];

    if (Array.isArray(obj)) {
      return obj.map(item => SecurityMiddleware.removeSensitiveData(item));
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const keyLower = key.toLowerCase();
      const isSensitive = sensitiveKeys.some(sensitive => keyLower.includes(sensitive));
      
      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (value && typeof value === 'object') {
        sanitized[key] = SecurityMiddleware.removeSensitiveData(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}

// Enhanced rate limiting for different endpoints
export const createRateLimit = (windowMs: number, max: number, message?: string) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: 'Rate limit exceeded',
      message: message || `Too many requests. Limit: ${max} requests per ${windowMs / 1000} seconds`
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        message: message || `Too many requests. Please try again later.`,
        retryAfter: Math.ceil(windowMs / 1000),
        limit: max,
        remaining: 0
      });
    }
  });
};

// Specific rate limits for different endpoints
export const rateLimits = {
  // General API rate limit
  general: createRateLimit(15 * 60 * 1000, 100), // 100 requests per 15 minutes
  
  // Strict rate limit for payment processing
  payment: createRateLimit(5 * 60 * 1000, 10), // 10 payments per 5 minutes
  
  // Authentication endpoints
  auth: createRateLimit(15 * 60 * 1000, 5), // 5 login attempts per 15 minutes
  
  // Device registration
  deviceRegistration: createRateLimit(60 * 60 * 1000, 50), // 50 device registrations per hour
  
  // API key generation (admin only)
  apiKeyGeneration: createRateLimit(60 * 60 * 1000, 5) // 5 API key generations per hour
};

// Encryption utilities for sensitive data
export class EncryptionUtils {
  private static algorithm = 'aes-256-cbc';
  private static key = process.env['ENCRYPTION_KEY'] ? 
    Buffer.from(process.env['ENCRYPTION_KEY'], 'hex') : 
    crypto.randomBytes(32);

  static encrypt(text: string): { encrypted: string; iv: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, this.key);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      encrypted,
      iv: iv.toString('hex')
    };
  }

  static decrypt(encrypted: string, _iv: string): string {
    const decipher = crypto.createDecipher(this.algorithm, this.key);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  static hashSensitiveData(data: string): string {
    return crypto.createHash('sha256').update(data + this.key.toString('hex')).digest('hex');
  }

  // Hash password with salt
  static hashPassword(password: string, salt?: string): { hash: string; salt: string } {
    const passwordSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, passwordSalt, 10000, 64, 'sha512').toString('hex');
    return { hash, salt: passwordSalt };
  }

  static verifyPassword(password: string, hash: string, salt: string): boolean {
    const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
  }
}

export default SecurityMiddleware;