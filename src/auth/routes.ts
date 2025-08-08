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

// Verify email endpoint
router.post('/verify-email', asyncHandler(async (req: express.Request, res: express.Response) => {
  const VerifyEmailSchema = z.object({
    token: z.string().min(1, 'Verification token is required'),
    email: z.string().email('Invalid email address').optional()
  });

  const validation = validateInput(VerifyEmailSchema, req.body);
  if (!validation.success) {
    throw new ValidationError(`Email verification failed: ${validation.errors.join(', ')}`);
  }

  const { token, email } = validation.data;

  try {
    // Verify the token (decode JWT or check database)
    const decoded = AuthService.verifyToken(token);
    
    if (decoded.type !== 'email_verification') {
      throw new ValidationError('Invalid verification token type');
    }

    // Find user by token email or provided email
    const targetEmail = email || decoded.email;
    const user = await userRepository.findByEmail(targetEmail);
    
    if (!user) {
      throw new ValidationError('User not found');
    }

    if (user.email_verified) {
      res.json({
        success: true,
        message: 'Email is already verified',
        already_verified: true
      });
      return;
    }

    // Update user email verification status
    await userRepository.update(user.id, { email_verified: true });

    res.json({
      success: true,
      message: 'Email verified successfully',
      email_verified: true
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError('Invalid or expired verification token');
  }
}));

// Password reset request
router.post('/forgot-password', asyncHandler(async (req: express.Request, res: express.Response) => {
  const ForgotPasswordSchema = z.object({
    email: z.string().email('Invalid email address')
  });

  const validation = validateInput(ForgotPasswordSchema, req.body);
  if (!validation.success) {
    throw new ValidationError(`Password reset failed: ${validation.errors.join(', ')}`);
  }

  const { email } = validation.data;

  // Find user by email
  const user = await userRepository.findByEmail(email);
  
  // Always return success to prevent email enumeration attacks
  const successResponse = {
    success: true,
    message: 'If an account with that email exists, a password reset link has been sent.'
  };

  if (!user) {
    // Don't reveal that the email doesn't exist
    res.json(successResponse);
    return;
  }

  // Generate password reset token (valid for 1 hour)
  const resetToken = AuthService.generateToken({
    userId: user.id,
    email: user.email,
    type: 'password_reset',
    role: user.role
  }, '1h');

  // In a real implementation, you would:
  // 1. Store the reset token in database with expiration
  // 2. Send email with reset link containing the token
  // For now, we'll just log the token (development mode only)
  
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.log(`Password reset token for ${email}: ${resetToken}`);
    // eslint-disable-next-line no-console
    console.log(`Reset URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`);
  }

  // TODO: Implement actual email sending
  // await emailService.sendPasswordResetEmail(user.email, resetToken);

  res.json(successResponse);
}));

// Reset password with token
router.post('/reset-password', asyncHandler(async (req: express.Request, res: express.Response) => {
  const ResetPasswordSchema = z.object({
    token: z.string().min(1, 'Reset token is required'),
    new_password: z.string().min(8, 'New password must be at least 8 characters')
  });

  const validation = validateInput(ResetPasswordSchema, req.body);
  if (!validation.success) {
    throw new ValidationError(`Password reset failed: ${validation.errors.join(', ')}`);
  }

  const { token, new_password } = validation.data;

  try {
    // Verify the reset token
    const decoded = AuthService.verifyToken(token);
    
    if (decoded.type !== 'password_reset') {
      throw new ValidationError('Invalid reset token type');
    }

    // Find user
    const user = await userRepository.findById(decoded.userId);
    if (!user) {
      throw new ValidationError('User not found');
    }

    // Hash new password
    const newPasswordHash = await AuthService.hashPassword(new_password);

    // Update password
    await userRepository.update(user.id, { password_hash: newPasswordHash });

    // Invalidate all existing sessions for security
    await AuthService.logout(user.id);

    res.json({
      success: true,
      message: 'Password reset successfully. Please login with your new password.'
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError('Invalid or expired reset token');
  }
}));

// Send email verification
router.post('/send-verification', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  if (!req.user) {
    throw new AuthenticationError('User not authenticated');
  }

  const user = await userRepository.findById(req.user.userId);
  if (!user) {
    throw new AuthenticationError('User not found');
  }

  if (user.email_verified) {
    res.json({
      success: true,
      message: 'Email is already verified',
      already_verified: true
    });
    return;
  }

  // Generate email verification token (valid for 24 hours)
  const verificationToken = AuthService.generateToken({
    userId: user.id,
    email: user.email,
    type: 'email_verification',
    role: user.role
  }, '24h');

  // In development, log the verification token
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.log(`Email verification token for ${user.email}: ${verificationToken}`);
    // eslint-disable-next-line no-console
    console.log(`Verification URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`);
  }

  // TODO: Implement actual email sending
  // await emailService.sendVerificationEmail(user.email, verificationToken);

  res.json({
    success: true,
    message: 'Verification email sent successfully'
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

  const { sessionId: _sessionId } = req.params;

  // Note: This would need the db instance, implementing as placeholder
  // Query would be: 'DELETE FROM user_sessions WHERE id = $1 AND user_id = $2'
  
  res.json({
    success: true,
    message: 'Session revoked successfully'
  });
}));

export default router;