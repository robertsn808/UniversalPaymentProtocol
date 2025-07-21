import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { userRepository } from '../database/repositories.js';
import { AuthenticationError, SecurityError } from '../utils/errors.js';
import { db } from '../database/connection.js';
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
export class AuthService {
    // Hash password
    static async hashPassword(password) {
        const saltRounds = 12;
        return bcrypt.hash(password, saltRounds);
    }
    // Verify password
    static async verifyPassword(password, hash) {
        return bcrypt.compare(password, hash);
    }
    // Generate JWT token
    static generateToken(payload) {
        return jwt.sign(payload, JWT_SECRET, {
            expiresIn: JWT_EXPIRES_IN,
            issuer: 'upp-api',
            audience: 'upp-clients'
        });
    }
    // Generate refresh token
    static generateRefreshToken(payload) {
        return jwt.sign(payload, JWT_SECRET, {
            expiresIn: REFRESH_TOKEN_EXPIRES_IN,
            issuer: 'upp-api',
            audience: 'upp-refresh'
        });
    }
    // Verify JWT token
    static verifyToken(token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET, {
                issuer: 'upp-api',
                audience: 'upp-clients'
            });
            return decoded;
        }
        catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                throw new AuthenticationError('Token expired');
            }
            else if (error instanceof jwt.JsonWebTokenError) {
                throw new AuthenticationError('Invalid token');
            }
            else {
                throw new AuthenticationError('Token verification failed');
            }
        }
    }
    // Verify refresh token
    static verifyRefreshToken(token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET, {
                issuer: 'upp-api',
                audience: 'upp-refresh'
            });
            return decoded;
        }
        catch (error) {
            throw new AuthenticationError('Invalid refresh token');
        }
    }
    // Login user
    static async login(email, password, deviceFingerprint) {
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
    static async refreshToken(refreshToken) {
        // Verify refresh token
        const payload = AuthService.verifyRefreshToken(refreshToken);
        // Check if session exists and is valid
        const sessionExists = await AuthService.isSessionValid(payload.userId, refreshToken);
        if (!sessionExists) {
            throw new AuthenticationError('Invalid session');
        }
        // Generate new tokens
        const newTokenPayload = {
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
    static async logout(userId, refreshToken) {
        if (refreshToken) {
            await AuthService.deleteSession(userId, refreshToken);
        }
        else {
            // Logout all sessions
            await AuthService.deleteAllSessions(userId);
        }
    }
    // Session management
    static async createSession(userId, refreshToken, deviceFingerprint) {
        const sessionId = jwt.decode(refreshToken);
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
    static async isSessionValid(userId, refreshToken) {
        const sessionId = jwt.decode(refreshToken);
        const query = `
      SELECT 1 FROM user_sessions 
      WHERE id = $1 AND user_id = $2 AND expires_at > NOW()
    `;
        const result = await db.query(query, [sessionId.jti || sessionId.iat, userId]);
        return result.rowCount > 0;
    }
    static async updateSession(userId, oldRefreshToken, newRefreshToken) {
        const oldSessionId = jwt.decode(oldRefreshToken);
        const newSessionId = jwt.decode(newRefreshToken);
        const expiresAt = new Date(newSessionId.exp * 1000);
        const query = `
      UPDATE user_sessions 
      SET id = $1, expires_at = $2
      WHERE id = $3 AND user_id = $4
    `;
        await db.query(query, [newSessionId.jti || newSessionId.iat, expiresAt, oldSessionId.jti || oldSessionId.iat, userId]);
    }
    static async deleteSession(userId, refreshToken) {
        const sessionId = jwt.decode(refreshToken);
        const query = 'DELETE FROM user_sessions WHERE id = $1 AND user_id = $2';
        await db.query(query, [sessionId.jti || sessionId.iat, userId]);
    }
    static async deleteAllSessions(userId) {
        const query = 'DELETE FROM user_sessions WHERE user_id = $1';
        await db.query(query, [userId]);
    }
    // Clean expired sessions
    static async cleanExpiredSessions() {
        const query = 'DELETE FROM user_sessions WHERE expires_at <= NOW()';
        await db.query(query);
    }
}
// JWT Authentication Middleware
export const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
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
    }
    catch (error) {
        next(error);
    }
};
// Optional authentication middleware (doesn't fail if no token)
export const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
        if (token) {
            const payload = AuthService.verifyToken(token);
            const user = await userRepository.findById(payload.userId);
            if (user && user.is_active) {
                req.user = payload;
            }
        }
        req.correlationId = `${Date.now()}-${Math.random().toString(36).substring(2)}`;
        next();
    }
    catch (error) {
        // Don't fail on optional auth errors
        req.correlationId = `${Date.now()}-${Math.random().toString(36).substring(2)}`;
        next();
    }
};
// Role-based authorization middleware
export const requireRole = (roles) => {
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    return (req, res, next) => {
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
export const authenticateApiKey = async (req, res, next) => {
    try {
        const apiKey = req.headers['x-api-key'];
        if (!apiKey) {
            throw new AuthenticationError('API key is required');
        }
        // Hash the API key to compare with stored hash
        const apiKeyHash = await AuthService.hashPassword(apiKey);
        const query = `
      SELECT ak.*, u.email, u.role, u.is_active
      FROM api_keys ak
      JOIN users u ON ak.user_id = u.id
      WHERE ak.key_hash = $1 AND ak.is_active = true AND (ak.expires_at IS NULL OR ak.expires_at > NOW())
    `;
        const result = await db.query(query, [apiKeyHash]);
        if (result.rowCount === 0) {
            throw new AuthenticationError('Invalid API key');
        }
        const apiKeyRecord = result.rows[0];
        if (!apiKeyRecord.is_active) {
            throw new AuthenticationError('User account is inactive');
        }
        // Update last used timestamp
        await db.query('UPDATE api_keys SET last_used = NOW() WHERE id = $1', [apiKeyRecord.id]);
        // Add user info to request
        req.user = {
            userId: apiKeyRecord.user_id,
            email: apiKeyRecord.email,
            role: apiKeyRecord.role
        };
        req.correlationId = `api-${Date.now()}-${Math.random().toString(36).substring(2)}`;
        next();
    }
    catch (error) {
        next(error);
    }
};
