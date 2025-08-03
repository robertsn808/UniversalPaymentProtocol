// Authentication Middleware for UPP Server
// Provides JWT-based authentication and API key validation

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../../src/config/environment.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    deviceId?: string;
  };
  apiKey?: {
    id: string;
    name: string;
    permissions: string[];
  };
}

// JWT Secret - in production, use a secure secret from environment
const JWT_SECRET = env.JWT_SECRET;

// API Keys storage - in production, use a database
const validApiKeys = new Map<string, { id: string; name: string; permissions: string[] }>([
  [env.UPP_API_KEY, { 
    id: 'default', 
    name: 'Default API Key', 
    permissions: ['device:register', 'payment:process', 'device:capabilities'] 
  }]
]);

// User sessions - in production, use Redis or database
const userSessions = new Map<string, any>();

export class AuthMiddleware {
  // JWT Authentication middleware
  static authenticateJWT = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Access token required',
        message: 'Please provide a valid JWT token in Authorization header'
      });
      return;
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        deviceId: decoded.deviceId
      };
      next();
    } catch (error) {
      res.status(403).json({
        success: false,
        error: 'Invalid token',
        message: 'JWT token is invalid or expired'
      });
      return;
    }
  };

  // API Key authentication middleware
  static authenticateApiKey = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const apiKey = req.headers['x-api-key'] as string || req.query['api_key'] as string;

    if (!apiKey) {
      res.status(401).json({
        success: false,
        error: 'API key required',
        message: 'Please provide an API key in X-API-Key header or api_key query parameter'
      });
      return;
    }

    const keyInfo = validApiKeys.get(apiKey);
    if (!keyInfo) {
      res.status(403).json({
        success: false,
        error: 'Invalid API key',
        message: 'The provided API key is not valid'
      });
      return;
    }

    req.apiKey = keyInfo;
    next();
  };

  // Optional authentication (try JWT first, then API key, then allow anonymous)
  static optionalAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'] as string;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      AuthMiddleware.authenticateJWT(req, res, next);
      return;
    } else if (apiKey) {
      AuthMiddleware.authenticateApiKey(req, res, next);
      return;
    } else {
      // No authentication provided, continue as anonymous
      next();
    }
  };

  // Role-based access control
  static requireRole = (...roles: string[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'This endpoint requires user authentication'
        });
        return;
      }

      if (!roles.includes(req.user.role)) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          message: `Required role: ${roles.join(' or ')}, current role: ${req.user.role}`
        });
        return;
      }

      next();
    };
  };

  // Permission-based access control for API keys
  static requirePermission = (...permissions: string[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.apiKey && !req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'This endpoint requires authentication'
        });
        return;
      }

      // Check API key permissions
      if (req.apiKey) {
        const hasPermission = permissions.some(permission => 
          req.apiKey!.permissions.includes(permission)
        );

        if (!hasPermission) {
          res.status(403).json({
            success: false,
            error: 'Insufficient permissions',
            message: `Required permission: ${permissions.join(' or ')}`
          });
          return;
        }
      }

      // Admin users bypass permission checks
      if (req.user && req.user.role === 'admin') {
        return next();
      }

      next();
    };
  };

  // Generate JWT token for user
  static generateToken = (user: { id: string; email: string; role: string; deviceId?: string }) => {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        deviceId: user.deviceId
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
  };

  // Generate API key
  static generateApiKey = (name: string, permissions: string[] = []) => {
    const apiKey = `upp_${crypto.randomBytes(16).toString('hex')}`;
    const keyInfo = {
      id: crypto.randomUUID(),
      name,
      permissions
    };
    
    validApiKeys.set(apiKey, keyInfo);
    return { apiKey, keyInfo };
  };

  // Revoke API key
  static revokeApiKey = (apiKey: string) => {
    return validApiKeys.delete(apiKey);
  };

  // List API keys (for admin)
  static listApiKeys = () => {
    return Array.from(validApiKeys.entries()).map(([key, info]) => ({
      key: key.substring(0, 8) + '...',
      ...info
    }));
  };
}

// Login endpoint helper
export const loginUser = async (email: string, password: string, deviceId?: string) => {
  // In production, validate against database
  const mockUsers = [
    { id: '1', email: 'admin@upp.com', password: 'admin123', role: 'admin' },
    { id: '2', email: 'user@upp.com', password: 'user123', role: 'user' },
    { id: '3', email: 'merchant@upp.com', password: 'merchant123', role: 'merchant' }
  ];

  const user = mockUsers.find(u => u.email === email && u.password === password);
  if (!user) {
    throw new Error('Invalid credentials');
  }

  const token = AuthMiddleware.generateToken({
    id: user.id,
    email: user.email,
    role: user.role,
    ...(deviceId && { deviceId })
  });

  // Store session
  userSessions.set(user.id, {
    email: user.email,
    role: user.role,
    loginTime: new Date(),
    deviceId
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role
    }
  };
};

export default AuthMiddleware;