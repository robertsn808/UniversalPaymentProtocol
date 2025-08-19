import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { apiKeyManager, APIKeyRegistration } from './api-key-management.js';
import { secureLogger } from '../shared/logger.js';
// Note: sanitizeInput is middleware, not imported as a function

const router = Router();

// Validation schemas
const registrationSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  organization: z.string().min(2).max(100),
  usage: z.enum(['development', 'production', 'testing']),
  description: z.string().min(10).max(500),
  webhookUrl: z.string().url().optional(),
  allowedOrigins: z.array(z.string().url()).optional()
});

const apiKeySchema = z.object({
  apiKey: z.string().min(10)
});

// Rate limiting middleware for registration
const registrationRateLimit = new Map<string, number>();

const checkRegistrationRateLimit = (req: Request, res: Response, next: Function): void => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const lastRequest = registrationRateLimit.get(ip) || 0;
  
  if (now - lastRequest < 60000) { // 1 minute between registrations
    res.status(429).json({
      error: 'Too many registration attempts',
      message: 'Please wait 1 minute between registration attempts',
      retryAfter: Math.ceil((60000 - (now - lastRequest)) / 1000)
    });
    return;
  }
  
  registrationRateLimit.set(ip, now);
  next();
};

// Register for a new API key
router.post('/register', checkRegistrationRateLimit, async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('API Key Registration Request:', {
      body: req.body,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    const validatedData = registrationSchema.parse(req.body);
    // Note: sanitizeInput is middleware, not a function to call directly
    // The data is already validated by Zod schema

    // Check if email already has an active API key
    const existingKey = await apiKeyManager.getAPIKeyInfo(validatedData.email);
    if (existingKey) {
      res.status(409).json({
        error: 'Email already registered',
        message: 'An API key already exists for this email address'
      });
      return;
    }

    const apiKeyData = await apiKeyManager.generateAPIKey(validatedData);

    secureLogger.info(`New API key registered for ${validatedData.email} (${validatedData.organization})`);

    res.status(201).json({
      success: true,
      message: 'API key generated successfully',
      data: {
        apiKey: apiKeyData.key,
        name: apiKeyData.name,
        organization: apiKeyData.organization,
        usage: apiKeyData.usage,
        permissions: apiKeyData.permissions,
        rateLimit: apiKeyData.rateLimit,
        createdAt: apiKeyData.createdAt,
        webhookUrl: apiKeyData.webhookUrl,
        allowedOrigins: apiKeyData.allowedOrigins
      },
      instructions: {
        header: 'X-API-Key',
        example: `Authorization: Bearer ${apiKeyData.key}`,
        documentation: '/docs/api'
      }
    });
  } catch (error) {
    console.error('API Key Registration Error:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        message: 'Invalid registration data',
        details: error.errors
      });
      return;
    }

    res.status(500).json({
      error: 'Registration failed',
      message: 'Failed to generate API key. Please try again later.'
    });
    return;
  }
});

// Validate API key
router.post('/validate', async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('API Key Validation Request:', {
      hasApiKey: !!req.body.apiKey,
      ip: req.ip
    });

    const { apiKey } = apiKeySchema.parse(req.body);
    
    const validation = await apiKeyManager.validateAPIKey(apiKey);
    
    if (!validation.isValid) {
      res.status(401).json({
        error: 'Invalid API key',
        message: validation.error
      });
      return;
    }

    res.json({
      success: true,
      message: 'API key is valid',
      data: {
        name: validation.keyData?.name,
        organization: validation.keyData?.organization,
        usage: validation.keyData?.usage,
        permissions: validation.keyData?.permissions,
        rateLimit: validation.keyData?.rateLimit,
        lastUsed: validation.keyData?.lastUsed
      }
    });
  } catch (error) {
    console.error('API Key Validation Error:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        message: 'Invalid request data',
        details: error.errors
      });
      return;
    }

    res.status(500).json({
      error: 'Validation failed',
      message: 'Failed to validate API key'
    });
    return;
  }
});

// Get API key information
router.get('/info', async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKey = req.headers.authorization?.replace('Bearer ', '') || 
                   req.headers['x-api-key'] as string;

    if (!apiKey) {
      res.status(401).json({
        error: 'Missing API key',
        message: 'Please provide API key in Authorization header or X-API-Key header'
      });
      return;
    }

    console.log('API Key Info Request:', {
      hasApiKey: !!apiKey,
      ip: req.ip
    });

    const keyInfo = await apiKeyManager.getAPIKeyInfo(apiKey);
    
    if (!keyInfo) {
      res.status(401).json({
        error: 'Invalid API key',
        message: 'The provided API key is invalid or inactive'
      });
      return;
    }

    // Get usage statistics
    const stats = await apiKeyManager.getAPIKeyStats(apiKey);

    res.json({
      success: true,
      data: {
        name: keyInfo.name,
        organization: keyInfo.organization,
        usage: keyInfo.usage,
        permissions: keyInfo.permissions,
        rateLimit: keyInfo.rateLimit,
        createdAt: keyInfo.createdAt,
        lastUsed: keyInfo.lastUsed,
        webhookUrl: keyInfo.webhookUrl,
        allowedOrigins: keyInfo.allowedOrigins,
        stats
      }
    });
  } catch (error) {
    console.error('API Key Info Error:', error);
    res.status(500).json({
      error: 'Failed to get API key info',
      message: 'Internal server error'
    });
  }
});

// Deactivate API key
router.delete('/deactivate', async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKey = req.headers.authorization?.replace('Bearer ', '') || 
                   req.headers['x-api-key'] as string;

    if (!apiKey) {
      res.status(401).json({
        error: 'Missing API key',
        message: 'Please provide API key in Authorization header or X-API-Key header'
      });
      return;
    }

    console.log('API Key Deactivation Request:', {
      hasApiKey: !!apiKey,
      ip: req.ip
    });

    const success = await apiKeyManager.deactivateAPIKey(apiKey);
    
    if (!success) {
      res.status(404).json({
        error: 'API key not found',
        message: 'The provided API key was not found or is already inactive'
      });
      return;
    }

    res.json({
      success: true,
      message: 'API key deactivated successfully'
    });
  } catch (error) {
    console.error('API Key Deactivation Error:', error);
    res.status(500).json({
      error: 'Failed to deactivate API key',
      message: 'Internal server error'
    });
  }
});

// Update API key usage
router.patch('/update-usage', async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKey = req.headers.authorization?.replace('Bearer ', '') || 
                   req.headers['x-api-key'] as string;

    if (!apiKey) {
      res.status(401).json({
        error: 'Missing API key',
        message: 'Please provide API key in Authorization header or X-API-Key header'
      });
      return;
    }

    const { usage } = z.object({
      usage: z.enum(['development', 'production', 'testing'])
    }).parse(req.body);

    console.log('API Key Usage Update Request:', {
      hasApiKey: !!apiKey,
      newUsage: usage,
      ip: req.ip
    });

    const success = await apiKeyManager.updateAPIKeyUsage(apiKey, usage);
    
    if (!success) {
      res.status(404).json({
        error: 'API key not found',
        message: 'The provided API key was not found'
      });
      return;
    }

    res.json({
      success: true,
      message: 'API key usage updated successfully',
      data: { usage }
    });
  } catch (error) {
    console.error('API Key Usage Update Error:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Validation error',
        message: 'Invalid usage type',
        details: error.errors
      });
      return;
    }

    res.status(500).json({
      error: 'Failed to update API key usage',
      message: 'Internal server error'
    });
    return;
  }
});

// Get API key statistics
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKey = req.headers.authorization?.replace('Bearer ', '') || 
                   req.headers['x-api-key'] as string;

    if (!apiKey) {
      res.status(401).json({
        error: 'Missing API key',
        message: 'Please provide API key in Authorization header or X-API-Key header'
      });
      return;
    }

    console.log('API Key Stats Request:', {
      hasApiKey: !!apiKey,
      ip: req.ip
    });

    const stats = await apiKeyManager.getAPIKeyStats(apiKey);
    
    if (!stats) {
      res.status(404).json({
        error: 'API key not found',
        message: 'The provided API key was not found'
      });
      return;
    }

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('API Key Stats Error:', error);
    res.status(500).json({
      error: 'Failed to get API key statistics',
      message: 'Internal server error'
    });
  }
});

export default router;
