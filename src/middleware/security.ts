

// Security Middleware - Protection Against Common Attacks
import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import sanitizeHtml from 'sanitize-html';

import { env } from '../config/environment.js';
import secureLogger from '../shared/logger.js';

// Request correlation ID middleware
export const correlationIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const correlationId = req.headers['x-correlation-id'] as string || 
    `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  
  next();
};

// Enhanced security headers middleware
export const securityHeadersMiddleware = helmet({
  // Content Security Policy - Enhanced for XSS protection
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "https://js.stripe.com"],
      connectSrc: ["'self'", "https://api.stripe.com", "https://events.stripe.com"],
      frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"],
      imgSrc: ["'self'", "data:", "https:"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"], // Prevent framing attacks
      upgradeInsecureRequests: []  // Force HTTPS in production
    },
    reportOnly: false // Enforce CSP policies
  },
  
  // HTTP Strict Transport Security (HSTS)
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  
  // Prevent clickjacking
  frameguard: { action: 'deny' },
  
  // Prevent MIME sniffing
  noSniff: true,
  
  // XSS Protection
  xssFilter: true,
  
  // Referrer Policy
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  
  // Hide X-Powered-By header
  hidePoweredBy: true,
  
  // DNS Prefetch Control
  dnsPrefetchControl: { allow: false },
  
  // Cross-Origin Embedder Policy
  crossOriginEmbedderPolicy: { policy: 'require-corp' },
  
  // Cross-Origin Opener Policy
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  
  // Cross-Origin Resource Policy
  crossOriginResourcePolicy: { policy: 'same-origin' }
});

// Rate limiting configurations
export const generalRateLimit = rateLimit({
  windowMs: env.API_RATE_LIMIT_WINDOW_MS,
  max: env.API_RATE_LIMIT_REQUESTS,
  message: {
    error: 'Too many requests from this IP',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: Math.ceil(env.API_RATE_LIMIT_WINDOW_MS / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for health checks from Render and other monitoring services
  skip: (req: Request) => {
    const userAgent = req.get('User-Agent') || '';
    const path = req.path;
    
    // Skip for Render health checks
    if (userAgent.includes('Render/') && path === '/health') {
      return true;
    }
    
    // Skip for other common health check services
    if (path === '/health' && (
      userAgent.includes('HealthCheck') ||
      userAgent.includes('monitoring') ||
      userAgent.includes('uptime') ||
      userAgent.includes('pingdom') ||
      userAgent.includes('NewRelic') ||
      req.ip?.startsWith('10.') // Internal network IPs
    )) {
      return true;
    }
    
    return false;
  },
  handler: (req: Request, res: Response) => {
    secureLogger.security('Rate limit exceeded', {
      correlationId: req.correlationId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method
    });
    
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this IP, please try again later'
      }
    });
  }
});

// Stricter rate limiting for payment endpoints
export const paymentRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 payment attempts per minute
  message: {
    error: 'Too many payment attempts',
    code: 'PAYMENT_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    secureLogger.security('Payment rate limit exceeded', {
      correlationId: req.correlationId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method,
      severity: 'HIGH'
    });
    
    res.status(429).json({
      success: false,
      error: {
        code: 'PAYMENT_RATE_LIMIT_EXCEEDED',
        message: 'Too many payment attempts, please wait before trying again'
      }
    });
  }
});

// Authentication rate limiting
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes
  message: {
    error: 'Too many authentication attempts',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  },
  handler: (req: Request, res: Response) => {
    secureLogger.security('Authentication rate limit exceeded', {
      correlationId: req.correlationId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method,
      severity: 'HIGH'
    });
    
    res.status(429).json({
      success: false,
      error: {
        code: 'AUTH_RATE_LIMIT_EXCEEDED',
        message: 'Too many authentication attempts, account temporarily locked'
      }
    });
  }
});

// Input sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  // Recursively sanitize object
  const sanitizeObject = (obj: any): any => {
    if (typeof obj !== 'object' || obj === null) {
      if (typeof obj === 'string') {
        // Use sanitize-html to clean input
        let sanitized = sanitizeHtml(obj.trim(), {
          allowedTags: [], // Remove all HTML tags
          allowedAttributes: {},
          allowedSchemes: ['http', 'https', 'mailto', 'tel'],
        });

        return sanitized.slice(0, 10000); // Limit string length
      }
      return obj;
    }
    
    const sanitized: any = Array.isArray(obj) ? [] : {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object') {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = sanitizeObject(value);
      }
    }
    
    return sanitized;
  };
  
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  
  next();
};

// Request size limiting middleware
export const requestSizeLimit = (maxSize: number = 1024 * 1024) => { // 1MB default
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.get('Content-Length') || '0');
    
    if (contentLength > maxSize) {
      secureLogger.security('Request size exceeded', {
        correlationId: req.correlationId,
        ipAddress: req.ip,
        contentLength: contentLength.toString(),
        maxSize: maxSize.toString(),
        path: req.path
      });
      
      res.status(413).json({
        success: false,
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'Request payload too large'
        }
      });
      return;
    }
    
    next();
  };
};

// HTTPS enforcement middleware (for production)
export const httpsRedirect = (req: Request, res: Response, next: NextFunction) => {
  if (env.NODE_ENV === 'production' && req.header('x-forwarded-proto') !== 'https') {
    secureLogger.security('HTTP request in production - redirecting to HTTPS', {
      correlationId: req.correlationId,
      ipAddress: req.ip,
      originalUrl: req.originalUrl
    });
    
    res.redirect(301, `https://${req.header('host')}${req.url}`);
    return;
  }
  
  next();
};

// Security headers validation
export const validateSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Log suspicious requests
  if (req.get('X-Requested-With') === 'XMLHttpRequest' && !req.get('Referer')) {
    secureLogger.security('AJAX request without referer header', {
      correlationId: req.correlationId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    });
  }
  
  next();
};

// Request logging middleware
export const requestLoggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Log incoming request
  secureLogger.http('Incoming request', {
    correlationId: req.correlationId,
    method: req.method,
    path: req.path,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length')
  });
  
  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any, cb?: any) {
    const duration = Date.now() - startTime;
    
    secureLogger.http('Request completed', {
      correlationId: req.correlationId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length')
    });
    
    return originalEnd.call(this, chunk, encoding, cb);
  };
  
  next();
};

// Declare the correlationId property on Request interface
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

