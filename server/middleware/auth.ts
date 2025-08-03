// Authentication Middleware for UPP Server
// Handles JWT and API key authentication with enhanced security

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { logSecurityEvent } from './security.js';

export interface AuthenticatedRequest extends Request {
  user?: any;
  apiKeyId?: string;
  deviceId?: string;
}

// Enhanced JWT Authentication middleware
export const authenticateJWT = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
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
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      logSecurityEvent('configuration_error', req, 'JWT_SECRET not configured', 'critical');
      res.status(500).json({ 
        success: false, 
        error: 'Server configuration error',
        code: 'CONFIG_ERROR'
      });
      return;
    }

    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      issuer: 'upp-server',
      audience: 'upp-client'
    });
    
    req.user = decoded;
    next();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logSecurityEvent('authentication_failure', req, `Invalid JWT token: ${errorMessage}`);
    
    res.status(403).json({ 
      success: false, 
      error: 'Invalid access token',
      code: 'INVALID_TOKEN'
    });
    return;
  }
};

// Enhanced API Key Authentication middleware
export const authenticateAPIKey = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const apiKey = req.headers['x-api-key'] as string || req.query['api_key'] as string;

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
  if (!apiKey.startsWith('upp_') || apiKey.length < 20) {
    logSecurityEvent('authentication_failure', req, 'Invalid API key format');
    res.status(401).json({ 
      success: false, 
      error: 'Invalid API key format',
      code: 'INVALID_API_KEY_FORMAT'
    });
    return;
  }

  // In production, validate against secure database
  // For now, validate against environment variable
  const validApiKey = process.env.UPP_API_KEY;
  if (!validApiKey) {
    logSecurityEvent('configuration_error', req, 'UPP_API_KEY not configured', 'critical');
    res.status(500).json({ 
      success: false, 
      error: 'Server configuration error',
      code: 'CONFIG_ERROR'
    });
    return;
  }

  // Use constant-time comparison to prevent timing attacks
  const providedKeyBuffer = Buffer.from(apiKey, 'utf8');
  const validKeyBuffer = Buffer.from(validApiKey, 'utf8');
  
  if (providedKeyBuffer.length !== validKeyBuffer.length || 
      !crypto.timingSafeEqual(providedKeyBuffer, validKeyBuffer)) {
    logSecurityEvent('authentication_failure', req, 'Invalid API key');
    res.status(401).json({ 
      success: false, 
      error: 'Invalid API key',
      code: 'INVALID_API_KEY'
    });
    return;
  }

  req.apiKeyId = apiKey;
  next();
};

// Device authentication middleware (for device-specific endpoints)
export const authenticateDevice = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const deviceId = req.headers['x-device-id'] as string;
  const deviceFingerprint = req.headers['x-device-fingerprint'] as string;

  if (!deviceId) {
    logSecurityEvent('authentication_failure', req, 'No device ID provided');
    res.status(401).json({ 
      success: false, 
      error: 'Device ID required',
      code: 'MISSING_DEVICE_ID'
    });
    return;
  }

  // Validate device ID format (UUID or custom format)
  const deviceIdPattern = /^[a-zA-Z0-9_-]+$/;
  if (!deviceIdPattern.test(deviceId)) {
    logSecurityEvent('authentication_failure', req, 'Invalid device ID format');
    res.status(401).json({ 
      success: false, 
      error: 'Invalid device ID format',
      code: 'INVALID_DEVICE_ID'
    });
    return;
  }

  // In production, validate device registration against database
  // For now, accept valid format
  req.deviceId = deviceId;
  
  if (deviceFingerprint) {
    // TODO: Validate device fingerprint against stored value
    // This helps prevent device spoofing
  }

  next();
};

// Multi-factor authentication (API Key + Device + optional JWT)
export const authenticateMultiFactor = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  // First, require API key
  authenticateAPIKey(req, res, (error) => {
    if (error) return;
    
    // Then, require device authentication
    authenticateDevice(req, res, (error) => {
      if (error) return;
      
      // Optionally check for JWT if provided
      const authHeader = req.headers.authorization;
      if (authHeader) {
        authenticateJWT(req, res, next);
      } else {
        next();
      }
    });
  });
};

// Optional authentication (for endpoints that work with or without auth)
export const optionalAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  const apiKey = req.headers['x-api-key'] as string || req.query['api_key'] as string;

  if (token) {
    try {
      const secret = process.env.JWT_SECRET;
      if (secret) {
        const decoded = jwt.verify(token, secret, {
          algorithms: ['HS256'],
          issuer: 'upp-server',
          audience: 'upp-client'
        });
        req.user = decoded;
      }
    } catch (error) {
      // Continue without authentication - it's optional
    }
  }

  if (apiKey && apiKey.startsWith('upp_')) {
    const validApiKey = process.env.UPP_API_KEY;
    if (validApiKey && apiKey === validApiKey) {
      req.apiKeyId = apiKey;
    }
  }

  next();
};

// Role-based access control middleware
export const requireRole = (requiredRole: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      logSecurityEvent('authorization_failure', req, 'No authenticated user for role check');
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
      return;
    }

    const userRole = req.user.role || 'user';
    if (userRole !== requiredRole && userRole !== 'admin') {
      logSecurityEvent('authorization_failure', req, `Insufficient role: ${userRole}, required: ${requiredRole}`);
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
      return;
    }

    next();
  };
};

// Generate secure API key
export const generateSecureAPIKey = (): string => {
  const randomBytes = crypto.randomBytes(32);
  const hash = crypto.createHash('sha256').update(randomBytes).digest('hex');
  return `upp_${hash.substring(0, 32)}`;
};

// Generate JWT token with proper claims
export const generateJWTToken = (payload: {
  userId: string;
  role?: string;
  deviceId?: string;
  [key: string]: any;
}): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET not configured');
  }

  return jwt.sign(
    {
      ...payload,
      iss: 'upp-server',
      aud: 'upp-client',
      iat: Math.floor(Date.now() / 1000),
    },
    secret,
    {
      algorithm: 'HS256',
      expiresIn: 3600 // 1 hour in seconds
    }
  );
};