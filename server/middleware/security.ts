// Security Middleware - Universal Payment Protocol
// Comprehensive security middleware for API protection

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import { 
  securityHeaders, 
  rateLimitConfig, 
  paymentRateLimitConfig,
  getAllowedOrigins,
  sanitizationPatterns,
  securityLogConfig,
  jwtConfig,
  apiKeyConfig,
  envSchema
} from '../../src/config/security.js';

// Validate environment variables on startup
export const validateEnvironment = () => {
  try {
    const env = envSchema.parse(process.env);
    console.log('✅ Environment variables validated successfully');
    return env;
  } catch (error) {
    console.error('❌ Environment validation failed:', error);
    process.exit(1);
  }
};

// Security headers middleware
export const securityHeadersMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for API compatibility
});

// CORS configuration
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins();
    
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`🚫 CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Device-ID'],
});

// Rate limiting middleware
export const rateLimitMiddleware = rateLimit(rateLimitConfig);
export const paymentRateLimitMiddleware = rateLimit(paymentRateLimitConfig);

// JWT Authentication middleware
export const authenticateJWT = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    logSecurityEvent('authentication_failure', req, 'No JWT token provided');
    res.status(401).json({ 
      success: false, 
      error: 'Access token required',
      code: 'MISSING_TOKEN' 
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!, jwtConfig);
    (req as any).user = decoded;
    next();
  } catch (error) {
    logSecurityEvent('authentication_failure', req, `Invalid JWT token: ${error}`);
    res.status(403).json({ 
      success: false, 
      error: 'Invalid access token',
      code: 'INVALID_TOKEN' 
    });
    return;
  }
};

// API Key Authentication middleware
export const authenticateAPIKey = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = req.headers['x-api-key'] as string || 
                 req.query['api_key'] as string;

  if (!apiKey) {
    logSecurityEvent('authentication_failure', req, 'No API key provided');
    res.status(401).json({ 
      success: false, 
      error: 'API key required',
      code: 'MISSING_API_KEY' 
    });
    return;
  }

  // Validate API key format
  if (!apiKey.startsWith(apiKeyConfig.prefix)) {
    logSecurityEvent('authentication_failure', req, 'Invalid API key format');
    res.status(401).json({ 
      success: false, 
      error: 'Invalid API key format',
      code: 'INVALID_API_KEY_FORMAT' 
    });
    return;
  }

  // In production, validate against database
  // For now, validate against environment variable
  const validApiKey = process.env.UPP_API_KEY;
  if (!validApiKey || apiKey !== validApiKey) {
    logSecurityEvent('authentication_failure', req, 'Invalid API key');
    res.status(401).json({ 
      success: false, 
      error: 'Invalid API key',
      code: 'INVALID_API_KEY' 
    });
    return;
  }

  next();
};

// Input sanitization middleware
export const sanitizeInput = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  if (req.query) {
    req.query = sanitizeObject(req.query as Record<string, any>);
  }
  
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }
  
  next();
};

// Recursive object sanitization
function sanitizeObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return sanitizeString(String(obj));
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  const sanitized: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const sanitizedKey = sanitizeString(key);
    sanitized[sanitizedKey] = sanitizeObject(value);
  }
  
  return sanitized;
}

// String sanitization
function sanitizeString(str: string): string {
  if (typeof str !== 'string') return str;
  
  return str
    .replace(sanitizationPatterns.removeHtml, '')
    .replace(sanitizationPatterns.removeScripts, '')
    .trim();
}

// Request validation middleware factory
export const validateRequest = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logSecurityEvent('invalid_request', req, `Validation error: ${JSON.stringify(error.errors)}`);
        res.status(400).json({
          success: false,
          error: 'Invalid request data',
          code: 'VALIDATION_ERROR',
          details: error.errors
        });
        return;
      }
      
      logSecurityEvent('invalid_request', req, `Unexpected validation error: ${error}`);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
      return;
    }
  };
};

// HTTPS enforcement middleware
export const enforceHTTPS = (req: Request, res: Response, next: NextFunction): void => {
  if (process.env.NODE_ENV === 'production' && !req.secure && req.get('X-Forwarded-Proto') !== 'https') {
    logSecurityEvent('security_violation', req, 'HTTP request in production');
    res.status(403).json({
      success: false,
      error: 'HTTPS required',
      code: 'HTTPS_REQUIRED'
    });
    return;
  }
  next();
};

// Content-Type validation middleware
export const validateContentType = (req: Request, res: Response, next: NextFunction): void => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.get('Content-Type');
    
    if (!contentType || !contentType.includes('application/json')) {
      logSecurityEvent('invalid_request', req, `Invalid content type: ${contentType}`);
      res.status(400).json({
        success: false,
        error: 'Content-Type must be application/json',
        code: 'INVALID_CONTENT_TYPE'
      });
      return;
    }
  }
  next();
};

// Request size limiting middleware
export const limitRequestSize = (maxSizeBytes: number = 1024 * 1024) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.get('Content-Length') || '0');
    
    if (contentLength > maxSizeBytes) {
      logSecurityEvent('invalid_request', req, `Request too large: ${contentLength} bytes`);
      res.status(413).json({
        success: false,
        error: 'Request entity too large',
        code: 'REQUEST_TOO_LARGE'
      });
      return;
    }
    
    next();
  };
};

// Security event logging
export const logSecurityEvent = (
  eventType: string, 
  req: Request, 
  details: string,
  level: string = 'medium'
): void => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event: eventType,
    level,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    method: req.method,
    url: req.originalUrl,
    details,
    headers: {
      authorization: req.get('Authorization') ? '[REDACTED]' : undefined,
      'x-api-key': req.get('X-API-Key') ? '[REDACTED]' : undefined,
      'content-type': req.get('Content-Type'),
      'user-agent': req.get('User-Agent'),
    }
  };

  // In production, send to security monitoring system
  if (process.env.NODE_ENV === 'production') {
    // TODO: Send to security monitoring service (Splunk, ELK, etc.)
    console.error(`🚨 SECURITY EVENT [${level.toUpperCase()}]:`, JSON.stringify(logEntry));
  } else {
    console.warn(`⚠️  Security Event [${eventType}]:`, details);
  }
};

// Error handling middleware for security
export const securityErrorHandler = (
  err: any, 
  req: Request, 
  res: Response, 
  _next: NextFunction
): void => {
  // Log the error
  logSecurityEvent('security_error', req, err.message, 'high');

  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  } else {
    res.status(500).json({
      success: false,
      error: err.message,
      code: 'INTERNAL_ERROR',
      stack: err.stack
    });
  }
};

// Generate secure API key
export const generateAPIKey = (): string => {
  const randomBytes = crypto.randomBytes(apiKeyConfig.keyLength);
  const hash = crypto.createHash(apiKeyConfig.algorithm).update(randomBytes).digest('hex');
  return `${apiKeyConfig.prefix}${hash}`;
};

// Generate JWT token
export const generateJWT = (payload: object): string => {
  return jwt.sign(payload, process.env.JWT_SECRET!, jwtConfig);
};

// Verify JWT token
export const verifyJWT = (token: string): any => {
  return jwt.verify(token, process.env.JWT_SECRET!, jwtConfig);
};