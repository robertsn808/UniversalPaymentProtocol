import { Request, Response, NextFunction } from 'express';
import { apiKeyManager } from '../auth/api-key-management.js';
import { secureLogger } from '../shared/logger.js';

export interface AuthenticatedRequest extends Request {
  apiKey?: {
    id: string;
    name: string;
    email: string;
    organization: string;
    usage: string;
    permissions: string[];
    rateLimit: number;
  };
}

// Rate limiting storage
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export const authenticateAPIKey = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const apiKey = req.headers.authorization?.replace('Bearer ', '') || 
                   req.headers['x-api-key'] as string;

    if (!apiKey) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'API key is required. Please provide it in the Authorization header or X-API-Key header.',
        documentation: '/docs/api/authentication'
      });
      return;
    }

    console.log('API Key Authentication:', {
      hasApiKey: !!apiKey,
      endpoint: req.path,
      method: req.method,
      ip: req.ip
    });

    const validation = await apiKeyManager.validateAPIKey(apiKey);
    
    if (!validation.isValid) {
      res.status(401).json({
        error: 'Invalid API key',
        message: validation.error || 'The provided API key is invalid or inactive',
        documentation: '/docs/api/authentication'
      });
      return;
    }

    // Attach API key data to request
    req.apiKey = {
      id: validation.keyData!.id,
      name: validation.keyData!.name,
      email: validation.keyData!.email,
      organization: validation.keyData!.organization,
      usage: validation.keyData!.usage,
      permissions: validation.keyData!.permissions,
      rateLimit: validation.keyData!.rateLimit
    };

    // Check rate limiting
    const rateLimitResult = await checkRateLimit(req.apiKey.id, req.apiKey.rateLimit);
    if (!rateLimitResult.allowed) {
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Rate limit exceeded. Limit: ${req.apiKey.rateLimit} requests per hour.`,
        retryAfter: rateLimitResult.retryAfter,
        limit: req.apiKey.rateLimit,
        remaining: rateLimitResult.remaining
      });
      return;
    }

    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': req.apiKey.rateLimit.toString(),
      'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
      'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
    });

    secureLogger.info(`API request authenticated for ${req.apiKey.email} (${req.apiKey.organization})`);
    next();
  } catch (error) {
    console.error('API Key Authentication Error:', error);
    res.status(500).json({
      error: 'Authentication error',
      message: 'Failed to authenticate API key'
    });
  }
};

export const requirePermission = (permission: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.apiKey) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'API key authentication is required'
      });
      return;
    }

    if (!req.apiKey.permissions.includes(permission)) {
      res.status(403).json({
        error: 'Insufficient permissions',
        message: `This endpoint requires the '${permission}' permission`,
        requiredPermission: permission,
        availablePermissions: req.apiKey.permissions
      });
      return;
    }

    next();
  };
};

export const requireUsage = (usage: 'development' | 'production' | 'testing') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.apiKey) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'API key authentication is required'
      });
      return;
    }

    if (req.apiKey.usage !== usage) {
      res.status(403).json({
        error: 'Invalid usage type',
        message: `This endpoint requires a '${usage}' API key`,
        requiredUsage: usage,
        currentUsage: req.apiKey.usage
      });
      return;
    }

    next();
  };
};

async function checkRateLimit(apiKeyId: string, limit: number): Promise<{
  allowed: boolean;
  remaining: number;
  retryAfter: number;
  resetTime: number;
}> {
  const now = Date.now();
  const hour = 60 * 60 * 1000; // 1 hour in milliseconds
  const resetTime = Math.ceil((now + hour) / 1000); // Unix timestamp for reset

  const key = `rate_limit:${apiKeyId}`;
  const current = rateLimitStore.get(key);

  if (!current || now > current.resetTime) {
    // First request or reset time passed
    rateLimitStore.set(key, { count: 1, resetTime: now + hour });
    return {
      allowed: true,
      remaining: limit - 1,
      retryAfter: hour / 1000,
      resetTime
    };
  }

  if (current.count >= limit) {
    // Rate limit exceeded
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((current.resetTime - now) / 1000),
      resetTime: Math.ceil(current.resetTime / 1000)
    };
  }

  // Increment count
  current.count++;
  rateLimitStore.set(key, current);

  return {
    allowed: true,
    remaining: limit - current.count,
    retryAfter: Math.ceil((current.resetTime - now) / 1000),
    resetTime
  };
}

// Optional authentication - doesn't fail if no API key provided
export const optionalAPIKeyAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const apiKey = req.headers.authorization?.replace('Bearer ', '') || 
                   req.headers['x-api-key'] as string;

    if (!apiKey) {
      // No API key provided, continue without authentication
      return next();
    }

    const validation = await apiKeyManager.validateAPIKey(apiKey);
    
    if (validation.isValid && validation.keyData) {
      req.apiKey = {
        id: validation.keyData.id,
        name: validation.keyData.name,
        email: validation.keyData.email,
        organization: validation.keyData.organization,
        usage: validation.keyData.usage,
        permissions: validation.keyData.permissions,
        rateLimit: validation.keyData.rateLimit
      };

      // Apply rate limiting for authenticated requests
      const rateLimitResult = await checkRateLimit(req.apiKey.id, req.apiKey.rateLimit);
      if (!rateLimitResult.allowed) {
        res.status(429).json({
          error: 'Rate limit exceeded',
          message: `Rate limit exceeded. Limit: ${req.apiKey.rateLimit} requests per hour.`,
          retryAfter: rateLimitResult.retryAfter,
          limit: req.apiKey.rateLimit,
          remaining: rateLimitResult.remaining
        });
        return;
      }

      res.set({
        'X-RateLimit-Limit': req.apiKey.rateLimit.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
      });
    }

    next();
  } catch (error) {
    console.error('Optional API Key Authentication Error:', error);
    // Continue without authentication on error
    next();
  }
};

// Log API request for analytics
export const logAPIRequest = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    if (req.apiKey) {
      secureLogger.info(`API Request: ${req.method} ${req.path}`, {
        apiKeyId: req.apiKey.id,
        organization: req.apiKey.organization,
        usage: req.apiKey.usage,
        statusCode: res.statusCode,
        duration: duration.toString(),
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
    } else {
      secureLogger.info(`Unauthenticated Request: ${req.method} ${req.path}`, {
        statusCode: res.statusCode,
        duration: duration.toString(),
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });
    }
  });

  next();
};
