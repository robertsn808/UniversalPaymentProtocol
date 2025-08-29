import { Request } from 'express';
import { JWTPayload } from '../auth/jwt.js';

// Use module augmentation to extend Express Request globally
declare module 'express-serve-static-core' {
  interface Request {
    // JWT user payload (from JWT authentication)  
    user?: JWTPayload;
    
    // API key data (from API key authentication)
    apiKey?: {
      id: string;
      name: string;
      email: string;
      organization: string;
      usage: string;
      permissions: string[];
      rateLimit: number;
    };
    
    // Request correlation ID for tracing
    correlationId?: string;
  }
}

// Unified authenticated request interface that extends Express Request
export interface AuthenticatedRequest extends Request {}

// Export for compatibility
export type { JWTPayload } from '../auth/jwt.js';