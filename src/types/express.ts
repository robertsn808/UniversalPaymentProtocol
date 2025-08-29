import { Request } from 'express';
import { JWTPayload } from '../auth/jwt.js';

// Unified authenticated request interface that properly extends Express Request
export interface AuthenticatedRequest extends Request {
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

// Export for compatibility
export type { JWTPayload } from '../auth/jwt.js';