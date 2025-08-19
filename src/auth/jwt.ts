import * as bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';

import { db } from '../database/connection.js';
import { userRepository } from '../database/repositories.js';
import { AuthenticationError, SecurityError } from '../utils/errors.js';

// Critical security: JWT secret must be set in environment
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'your-super-secret-jwt-key-change-in-production') {
  throw new Error('JWT_SECRET environment variable must be set to a secure random string');
}

// Type assertion since we've validated it exists
const VALIDATED_JWT_SECRET: string = JWT_SECRET;

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

export interface JWTPayload {
  id: number;         // Primary identifier (alias for userId for compatibility)
  userId: number;     // Keep for backward compatibility
  email: string;
  role: string;
  deviceFingerprint?: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
  correlationId?: string;
}

export class AuthService {
  // Validate password strength
  static validatePasswordStrength(password: string): { isValid: boolean; errors?: string[] } {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    
    return {
      isValid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  // Hash password
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  // Verify password
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // Generate JWT token
  static generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload as object, VALIDATED_JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'upp-api',
      audience: 'upp-clients'
    } as jwt.SignOptions);
  }

  // Generate refresh token
  static generateRefreshToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload as object, VALIDATED_JWT_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
      issuer: 'upp-api',
      audience: 'upp-refresh'
    } as jwt.SignOptions);
  }

  // Verify JWT token
  static verifyToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, VALIDATED_JWT_SECRET, {
        issuer: 'upp-api',
        audience: 'upp-clients'
      }) as JWTPayload;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthenticationError('Token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Invalid token');
      } else {
        throw new AuthenticationError('Token verification failed');
      }
    }
  }

  // Verify refresh token
  static verifyRefreshToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, VALIDATED_JWT_SECRET, {
        issuer: 'upp-api',
        audience: 'upp-refresh'
      }) as JWTPayload;
      return decoded;
    } catch (error) {
      throw new AuthenticationError('Invalid refresh token');
    }
  }

  // Login user
  static async login(email: string, password: string, deviceFingerprint?: string): Promise<{
    user: any;
    accessToken: string;
    refreshToken: string;
  }> {
    // Find user by email
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new AuthenticationError('Invalid credentials');
    }

    // Check if user is active
    if (!user.is_active) {
      throw new AuthenticationError('Account is deactivated');
    }

    // Verify password
    const isValidPassword = await AuthService.verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      throw new AuthenticationError('Invalid credentials');
    }

    // Generate tokens
    const tokenPayload = {
      id: user.id,
      userId: user.id,
      email: user.email,
      role: user.role,
      deviceFingerprint
    };

    const accessToken = AuthService.generateToken(tokenPayload);
    const refreshToken = AuthService.generateRefreshToken(tokenPayload);

    // Update last login
    await userRepository.updateLastLogin(user.id);

    // Create session record
    await AuthService.createSession(user.id, refreshToken, deviceFingerprint);

    // Remove password hash from response
    const { password_hash, ...userResponse } = user;

    return {
      user: userResponse,
      accessToken,
      refreshToken
    };
  }

  // Refresh token
  static async refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    // Verify refresh token
    const payload = AuthService.verifyRefreshToken(refreshToken);

    // Check if session exists and is valid
    const sessionExists = await AuthService.isSessionValid(payload.userId, refreshToken);
    if (!sessionExists) {
      throw new AuthenticationError('Invalid session');
    }

    // Generate new tokens
    const newTokenPayload = {
      id: payload.userId,
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      deviceFingerprint: payload.deviceFingerprint
    };

    const newAccessToken = AuthService.generateToken(newTokenPayload);
    const newRefreshToken = AuthService.generateRefreshToken(newTokenPayload);

    // Update session with new refresh token
    await AuthService.updateSession(payload.userId, refreshToken, newRefreshToken);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    };
  }

  // Logout user
  static async logout(userId: number, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await AuthService.deleteSession(userId, refreshToken);
    } else {
      // Logout all sessions
      await AuthService.deleteAllSessions(userId);
    }
  }

  // Session management
  private static async createSession(userId: number, refreshToken: string, deviceFingerprint?: string): Promise<void> {
    const sessionId = jwt.decode(refreshToken) as any;
    const expiresAt = new Date(sessionId.exp * 1000);

    const query = `
      INSERT INTO user_sessions (id, user_id, device_fingerprint, expires_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE SET
        device_fingerprint = $3,
        expires_at = $4
    `;
    await db.query(query, [sessionId.jti || sessionId.iat, userId, deviceFingerprint, expiresAt]);
  }

  private static async isSessionValid(userId: number, refreshToken: string): Promise<boolean> {
    const sessionId = jwt.decode(refreshToken) as any;
    
    const query = `
      SELECT 1 FROM user_sessions 
      WHERE id = $1 AND user_id = $2 AND expires_at > NOW()
    `;
    const result = await db.query(query, [sessionId.jti || sessionId.iat, userId]);
    return result.rowCount > 0;
  }

  private static async updateSession(userId: number, oldRefreshToken: string, newRefreshToken: string): Promise<void> {
    const oldSessionId = jwt.decode(oldRefreshToken) as any;
    const newSessionId = jwt.decode(newRefreshToken) as any;
    const expiresAt = new Date(newSessionId.exp * 1000);

    const query = `
      UPDATE user_sessions 
      SET id = $1, expires_at = $2
      WHERE id = $3 AND user_id = $4
    `;
    await db.query(query, [newSessionId.jti || newSessionId.iat, expiresAt, oldSessionId.jti || oldSessionId.iat, userId]);
  }

  private static async deleteSession(userId: number, refreshToken: string): Promise<void> {
    const sessionId = jwt.decode(refreshToken) as any;
    
    const query = 'DELETE FROM user_sessions WHERE id = $1 AND user_id = $2';
    await db.query(query, [sessionId.jti || sessionId.iat, userId]);
  }

  private static async deleteAllSessions(userId: number): Promise<void> {
    const query = 'DELETE FROM user_sessions WHERE user_id = $1';
    await db.query(query, [userId]);
  }

  // Clean expired sessions
  static async cleanExpiredSessions(): Promise<void> {
    const query = 'DELETE FROM user_sessions WHERE expires_at <= NOW()';
    await db.query(query);
  }
}

// JWT Authentication Middleware
export const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      throw new AuthenticationError('Access token is required');
    }

    // Verify token
    const payload = AuthService.verifyToken(token);

    // Verify user still exists and is active
    const user = await userRepository.findById(payload.userId);
    if (!user || !user.is_active) {
      throw new AuthenticationError('User not found or inactive');
    }

    // Add user to request
    req.user = payload;
    
    // Generate correlation ID for request tracking
    req.correlationId = `${Date.now()}-${Math.random().toString(36).substring(2)}`;

    next();
  } catch (error) {
    next(error);
  }
};

// Optional authentication middleware (doesn't fail if no token)
export const optionalAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (token) {
      const payload = AuthService.verifyToken(token);
      const user = await userRepository.findById(payload.userId);
      
      if (user && user.is_active) {
        req.user = payload;
      }
    }

    req.correlationId = `${Date.now()}-${Math.random().toString(36).substring(2)}`;
    next();
  } catch (error) {
    // Don't fail on optional auth errors
    req.correlationId = `${Date.now()}-${Math.random().toString(36).substring(2)}`;
    next();
  }
};

// Role-based authorization middleware
export const requireRole = (roles: string | string[]) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new SecurityError('Insufficient permissions'));
    }

    next();
  };
};

// API Key authentication middleware
export const authenticateApiKey = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      throw new AuthenticationError('API key is required');
    }

    // Get all active API keys for comparison
    const query = `
      SELECT ak.*, u.email, u.role, u.is_active
      FROM api_keys ak
      JOIN users u ON ak.user_id = u.id
      WHERE ak.is_active = true AND (ak.expires_at IS NULL OR ak.expires_at > NOW())
    `;
    const result = await db.query(query);
    
    if (result.rowCount === 0) {
      throw new AuthenticationError('No valid API keys found');
    }

    // Compare the provided API key with stored hashes
    let validApiKey = null;
    for (const apiKeyRecord of result.rows) {
      const isValid = await AuthService.verifyPassword(apiKey, apiKeyRecord.key_hash);
      if (isValid) {
        validApiKey = apiKeyRecord;
        break;
      }
    }
    
    if (!validApiKey) {
      throw new AuthenticationError('Invalid API key');
    }
    
    if (!validApiKey.is_active) {
      throw new AuthenticationError('User account is inactive');
    }

    // Update last used timestamp
    await db.query('UPDATE api_keys SET last_used = NOW() WHERE id = $1', [validApiKey.id]);

    // Add user info to request
    req.user = {
      id: validApiKey.user_id,
      userId: validApiKey.user_id,
      email: validApiKey.email,
      role: validApiKey.role
    };

    req.correlationId = `api-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    next();
  } catch (error) {
    next(error);
  }
};

// Create and export jwtService instance
export const jwtService = new AuthService();

// Export User type for compatibility
export interface User {
  id: number;
  email: string;
  password_hash: string;
  role: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}