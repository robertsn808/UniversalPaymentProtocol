import { Request } from 'express';
import { JWTPayload } from '../auth/jwt.js';

// Utility type for authenticated requests with all Express properties
export type FullAuthenticatedRequest = Request & {
  user?: JWTPayload;
  apiKey?: {
    id: string;
    name: string;
    email: string;
    organization: string;
    usage: string;
    permissions: string[];
    rateLimit: number;
  };
  correlationId?: string;
};

// Type assertion helper to ensure type safety
export function asAuthenticatedRequest(req: any): FullAuthenticatedRequest {
  return req as FullAuthenticatedRequest;
}

// Export the original interface for backwards compatibility
export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
  apiKey?: {
    id: string;
    name: string;
    email: string;
    organization: string;
    usage: string;
    permissions: string[];
    rateLimit: number;
  };
  correlationId?: string;
}

export type { JWTPayload } from '../auth/jwt.js';