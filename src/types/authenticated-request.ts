import { Request } from 'express';
import { JWTPayload } from '../auth/jwt.js';

// Use intersection type to ensure all Express Request properties are available
export type AuthenticatedRequest = Request & {
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
};

// Export for compatibility
export type { JWTPayload } from '../auth/jwt.js';