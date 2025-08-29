import { JWTPayload } from '../auth/jwt.js';

declare global {
  namespace Express {
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
}

export {}; // Make this file a module