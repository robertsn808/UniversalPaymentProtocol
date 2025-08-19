
import { Router, Request, Response } from 'express';
import { z } from 'zod';


import { db } from '../database/connection.js';
import { userRepository } from '../database/repositories.js';
import { asyncHandler, ValidationError, AuthenticationError } from '../utils/errors.js';
import { validateInput } from '../utils/validation.js';

import { AuthService, authenticateToken, AuthenticatedRequest } from './jwt.js';
import { auditTrail } from '../compliance/audit-trail.js';
import secureLogger from '../shared/logger.js';
import { authRateLimit } from '../middleware/security.js';
import * as crypto from 'crypto';


const router = Router();

// Validation schemas
const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  terms_accepted: z.boolean().refine(val => val === true, 'Must accept terms and conditions')
});

const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
});

const ChangePasswordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string().min(8, 'New password must be at least 8 characters')
});

const ForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address')
});

const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  new_password: z.string().min(8, 'New password must be at least 8 characters')
});

/**
 * Register new user
 */
router.post('/register', authRateLimit, async (req: Request, res: Response): Promise<void> => {
  const correlationId = req.correlationId || `reg_${Date.now()}`;

  try {
    secureLogger.info('User registration attempt', {
      correlationId,
      email: req.body.email,
      ipAddress: req.ip
    });

    // Validate request
    const validatedData = RegisterSchema.parse(req.body);

    // Validate password strength
    const passwordValidation = AuthService.validatePasswordStrength(validatedData.password);
    if (!passwordValidation.isValid) {
      res.status(400).json({
        success: false,
        error: 'Password does not meet requirements',
        details: passwordValidation.errors
      });
      return;
    }

    // Check if user already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [validatedData.email]
    );

    if (existingUser.rows.length > 0) {
      // Log registration failure due to existing email
      secureLogger.warn('Registration attempt with existing email', {
        email: validatedData.email,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });

      res.status(409).json({
        success: false,
        error: 'User with this email already exists'
      });
      return;
    }

    // Hash password
    const passwordHash = await AuthService.hashPassword(validatedData.password);

    // Create user
    const userId = `user_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`;
    const user = await db.query(
      `INSERT INTO users (id, email, password_hash, name, role, is_verified, created_at, updated_at, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, email, name, role, is_verified, created_at`,
      [
        userId,
        validatedData.email,
        passwordHash,
        validatedData.name || null,
        'user',
        false,
        new Date(),
        new Date(),
        JSON.stringify({})
      ]
    );

    const newUser = user.rows[0];

    // Generate tokens
    const accessToken = AuthService.generateToken({
      id: newUser.id,
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role
    });
    const refreshToken = AuthService.generateRefreshToken({
      id: newUser.id,
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role
    });

    // Log successful registration
    await auditTrail.logAuthEvent({
      user_id: newUser.id,
      action: 'account_created',
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    secureLogger.info('User registered successfully', {
      correlationId,
      userId: newUser.id,
      email: newUser.email
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        is_verified: newUser.is_verified,
        created_at: newUser.created_at
      },
      tokens: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: 86400 // 24 hours
      }
    });

  } catch (error) {
    secureLogger.error('User registration failed', {
      correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
      email: req.body.email
    });

    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Registration failed'
    });
  }
});

/**
 * User login
 */
router.post('/login', authRateLimit, async (req: Request, res: Response): Promise<void> => {
  const correlationId = req.correlationId || `login_${Date.now()}`;

  try {
    secureLogger.info('User login attempt', {
      correlationId,
      email: req.body.email,
      ipAddress: req.ip
    });

    // Validate request
    const validatedData = LoginSchema.parse(req.body);

    // Get user from database
    const userResult = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [validatedData.email]
    );

    if (userResult.rows.length === 0) {
      await auditTrail.logAuthEvent({
        user_id: validatedData.email,
        action: 'login_failure',
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        metadata: { reason: 'user_not_found' }
      });

      res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
      return;
    }

    const user = userResult.rows[0];

    // Verify password
    const isPasswordValid = await AuthService.verifyPassword(
      validatedData.password,
      user.password_hash
    );

    if (!isPasswordValid) {
      await auditTrail.logAuthEvent({
        user_id: user.id,
        action: 'login_failure',
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        metadata: { reason: 'invalid_password' }
      });

      res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
      return;
    }

    // Generate tokens
    const accessToken = AuthService.generateToken({
      id: user.id,
      userId: user.id,
      email: user.email,
      role: user.role
    });
    const refreshToken = AuthService.generateRefreshToken({
      id: user.id,
      userId: user.id,
      email: user.email,
      role: user.role
    });

    // Update last login
    await db.query(
      'UPDATE users SET updated_at = $1 WHERE id = $2',
      [new Date(), user.id]
    );

    // Log successful login
    await auditTrail.logAuthEvent({
      user_id: user.id,
      action: 'login_success',
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    secureLogger.info('User logged in successfully', {
      correlationId,
      userId: user.id,
      email: user.email
    });

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        is_verified: user.is_verified
      },
      tokens: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: 86400 // 24 hours
      }
    });

  } catch (error) {
    secureLogger.error('User login failed', {
      correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
      email: req.body.email
    });

    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
});

/**
 * Refresh access token
 */
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      res.status(400).json({
        success: false,
        error: 'Refresh token is required'
      });
      return;
    }

    // Verify refresh token
    const decoded = AuthService.verifyToken(refresh_token);
    if (!decoded) {
      res.status(401).json({
        success: false,
        error: 'Invalid refresh token'
      });
      return;
    }

    // Get user from database
    const userResult = await db.query(
      'SELECT id, email, role FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      res.status(401).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    const user = userResult.rows[0];

    // Generate new access token
    const accessToken = AuthService.generateToken({
      id: user.id,
      userId: user.id,
      email: user.email,
      role: user.role
    });

    res.json({
      success: true,
      tokens: {
        access_token: accessToken,
        expires_in: 86400
      }
    });

  } catch (error) {
    secureLogger.error('Token refresh failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      success: false,
      error: 'Token refresh failed'
    });
  }
});

/**
 * Logout user
 */
router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  try {
    const authHeader = req.get('Authorization');
    const token = authHeader?.split(' ')[1]; // Bearer TOKEN

    if (token) {
      const decoded = AuthService.verifyToken(token);
      if (decoded) {
        await auditTrail.logAuthEvent({
          user_id: decoded.userId.toString(),
          action: 'logout',
          ip_address: req.ip,
          user_agent: req.get('User-Agent')
        });
      }
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    secureLogger.error('Logout failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
});

/**
 * Get current user profile
 */
router.get('/profile', async (req: Request, res: Response): Promise<void> => {
  const correlationId = req.correlationId || `profile_${Date.now()}`;
  
  try {
    const authHeader = req.get('Authorization');
    const token = authHeader?.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Authorization token required'
      });
      return;
    }

    const decoded = AuthService.verifyToken(token);
    if (!decoded) {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
      return;
    }
    
    // Get user from database
    const userResult = await db.query(
      'SELECT id, email, name, role, is_verified, created_at, updated_at FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'User not found'
      });
      return;
    }

    const user = userResult.rows[0];

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        is_verified: user.is_verified,
        created_at: user.created_at,
        updated_at: user.updated_at
      }
    });

  } catch (error) {
    secureLogger.error('Profile fetch failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile'
    });
  }
});

export default router;
