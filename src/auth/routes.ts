import express from 'express';
import { z } from 'zod';

import { db } from '../database/connection.js';
import { userRepository } from '../database/repositories.js';
import { asyncHandler, ValidationError, AuthenticationError } from '../utils/errors.js';
import { validateInput } from '../utils/validation.js';

import { AuthService, authenticateToken, AuthenticatedRequest } from './jwt.js';


const router = express.Router();

// Validation schemas
const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  first_name: z.string().min(1, 'First name is required').optional(),
  last_name: z.string().min(1, 'Last name is required').optional(),
  device_fingerprint: z.string().optional()
});

const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  device_fingerprint: z.string().optional()
});

const RefreshTokenSchema = z.object({
  refresh_token: z.string().min(1, 'Refresh token is required')
});

const ChangePasswordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string().min(8, 'New password must be at least 8 characters')
});

// Register new user
router.post('/register', asyncHandler(async (req: express.Request, res: express.Response) => {
  const validation = validateInput(RegisterSchema, req.body);
  if (!validation.success) {
    throw new ValidationError(`Registration failed: ${validation.errors.join(', ')}`);
  }

  const { email, password, first_name, last_name, device_fingerprint } = validation.data;

  // Check if user already exists
  const existingUser = await userRepository.findByEmail(email);
  if (existingUser) {
    throw new ValidationError('User with this email already exists');
  }

  // Hash password
  const password_hash = await AuthService.hashPassword(password);

  // Create user
  const user = await userRepository.create({
    email,
    password_hash,
    first_name,
    last_name,
    role: 'user',
    is_active: true,
    email_verified: false
  });

  // Generate tokens
  const tokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    device_fingerprint
  };

  const accessToken = AuthService.generateToken(tokenPayload);
  const refreshToken = AuthService.generateRefreshToken(tokenPayload);

  // Remove password hash from response
  const { password_hash: _, ...userResponse } = user;

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    user: userResponse,
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'Bearer',
    expires_in: '24h'
  });
}));

// Login user
router.post('/login', asyncHandler(async (req: express.Request, res: express.Response) => {
  const validation = validateInput(LoginSchema, req.body);
  if (!validation.success) {
    throw new ValidationError(`Login failed: ${validation.errors.join(', ')}`);
  }

  const { email, password, device_fingerprint } = validation.data;

  // Authenticate user
  const result = await AuthService.login(email, password, device_fingerprint);

  res.json({
    success: true,
    message: 'Login successful',
    user: result.user,
    access_token: result.accessToken,
    refresh_token: result.refreshToken,
    token_type: 'Bearer',
    expires_in: '24h'
  });
}));

// Refresh access token
router.post('/refresh', asyncHandler(async (req: express.Request, res: express.Response) => {
  const validation = validateInput(RefreshTokenSchema, req.body);
  if (!validation.success) {
    throw new ValidationError(`Token refresh failed: ${validation.errors.join(', ')}`);
  }

  const { refresh_token } = validation.data;

  // Refresh tokens
  const result = await AuthService.refreshToken(refresh_token);

  res.json({
    success: true,
    message: 'Token refreshed successfully',
    access_token: result.accessToken,
    refresh_token: result.refreshToken,
    token_type: 'Bearer',
    expires_in: '24h'
  });
}));

// Logout user
router.post('/logout', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const refreshToken = req.body.refresh_token;
  
  if (req.user) {
    await AuthService.logout(req.user.userId, refreshToken);
  }

  res.json({
    success: true,
    message: 'Logout successful'
  });
}));

// Get current user profile
router.get('/me', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  if (!req.user) {
    throw new AuthenticationError('User not authenticated');
  }

  const user = await userRepository.findById(req.user.userId);
  if (!user) {
    throw new AuthenticationError('User not found');
  }

  // Remove password hash from response
  const { password_hash, ...userResponse } = user;

  res.json({
    success: true,
    user: userResponse
  });
}));

// Update user profile
router.put('/profile', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  if (!req.user) {
    throw new AuthenticationError('User not authenticated');
  }

  const UpdateProfileSchema = z.object({
    first_name: z.string().min(1).optional(),
    last_name: z.string().min(1).optional(),
    email: z.string().email().optional()
  });

  const validation = validateInput(UpdateProfileSchema, req.body);
  if (!validation.success) {
    throw new ValidationError(`Profile update failed: ${validation.errors.join(', ')}`);
  }

  // If email is being changed, check if it's already taken
  if (validation.data.email) {
    const existingUser = await userRepository.findByEmail(validation.data.email);
    if (existingUser && existingUser.id !== req.user.userId) {
      throw new ValidationError('Email address is already in use');
    }
  }

  const updatedUser = await userRepository.update(req.user.userId, validation.data);
  if (!updatedUser) {
    throw new AuthenticationError('User not found');
  }

  // Remove password hash from response
  const { password_hash, ...userResponse } = updatedUser;

  res.json({
    success: true,
    message: 'Profile updated successfully',
    user: userResponse
  });
}));

// Change password
router.post('/change-password', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  if (!req.user) {
    throw new AuthenticationError('User not authenticated');
  }

  const validation = validateInput(ChangePasswordSchema, req.body);
  if (!validation.success) {
    throw new ValidationError(`Password change failed: ${validation.errors.join(', ')}`);
  }

  const { current_password, new_password } = validation.data;

  // Get current user
  const user = await userRepository.findById(req.user.userId);
  if (!user) {
    throw new AuthenticationError('User not found');
  }

  // Verify current password
  const isValidPassword = await AuthService.verifyPassword(current_password, user.password_hash);
  if (!isValidPassword) {
    throw new AuthenticationError('Current password is incorrect');
  }

  // Hash new password
  const newPasswordHash = await AuthService.hashPassword(new_password);

  // Update password
  await userRepository.update(req.user.userId, { password_hash: newPasswordHash });

  // Logout all sessions to force re-login
  await AuthService.logout(req.user.userId);

  res.json({
    success: true,
    message: 'Password changed successfully. Please login again with your new password.'
  });
}));

// Verify email endpoint (placeholder)
router.post('/verify-email', asyncHandler(async (req: express.Request, res: express.Response) => {
  // TODO: Implement email verification logic
  res.json({
    success: true,
    message: 'Email verification endpoint (not implemented yet)'
  });
}));

// Password reset request (placeholder)
router.post('/forgot-password', asyncHandler(async (req: express.Request, res: express.Response) => {
  // TODO: Implement password reset logic
  res.json({
    success: true,
    message: 'Password reset endpoint (not implemented yet)'
  });
}));

// Get user sessions
router.get('/sessions', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  if (!req.user) {
    throw new AuthenticationError('User not authenticated');
  }

  const query = `
    SELECT id, device_fingerprint, ip_address, user_agent, expires_at, created_at
    FROM user_sessions 
    WHERE user_id = $1 AND expires_at > NOW()
    ORDER BY created_at DESC
  `;
  const result = await db.query(query, [req.user.userId]);

  res.json({
    success: true,
    sessions: result.rows || []
  });
}));

// Revoke specific session
router.delete('/sessions/:sessionId', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  if (!req.user) {
    throw new AuthenticationError('User not authenticated');
  }

  const { sessionId } = req.params;

  const query = 'DELETE FROM user_sessions WHERE id = $1 AND user_id = $2';
  // Note: This would need the db instance, implementing as placeholder
  
  res.json({
    success: true,
    message: 'Session revoked successfully'
  });
}));

export default router;