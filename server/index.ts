import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { z } from 'zod';
import { AuthMiddleware, AuthenticatedRequest, loginUser } from './middleware/auth.js';
import { SecurityMiddleware, rateLimits } from './middleware/security.js';
import { UPPStripeProcessor } from './stripe-integration.js';
import { DeviceAdapterFactory } from '../src/modules/universal-payment-protocol/devices/DeviceAdapterFactory.js';
import { SecurityManagerAdapter } from './SecurityManagerAdapter.js';
import { CurrencyManager } from '../src/modules/universal-payment-protocol/currency/CurrencyManager.js';
import { env, validateEnvironment } from '../src/config/environment.js';

// Load and validate environment variables
dotenv.config();

try {
  validateEnvironment();
} catch (error) {
  console.error('❌ Environment validation failed:', (error as Error).message);
  process.exit(1);
}

const app = express();
const PORT = env.PORT;

// Input validation schemas
const PaymentRequestSchema = z.object({
  amount: z.number().positive().max(1000000), // Max $10,000
  currency: z.string().length(3).default('USD'),
  deviceType: z.enum(['smartphone', 'smart_tv', 'iot_device', 'voice_assistant', 'gaming_console', 'smartwatch', 'car_system']),
  deviceId: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  customerEmail: z.string().email().optional(),
  metadata: z.record(z.string()).optional()
});

const DeviceRegistrationSchema = z.object({
  deviceType: z.enum(['smartphone', 'smart_tv', 'iot_device', 'voice_assistant', 'gaming_console', 'smartwatch', 'car_system']),
  capabilities: z.array(z.string()).min(1),
  fingerprint: z.string().min(10).max(500),
  userAgent: z.string().optional(),
  ipAddress: z.string().optional()
});

// Initialize core services
let stripeProcessor: UPPStripeProcessor;
let securityManager: SecurityManagerAdapter;
let currencyManager: CurrencyManager;

try {
  stripeProcessor = new UPPStripeProcessor();
  securityManager = new SecurityManagerAdapter();
  currencyManager = new CurrencyManager();
  console.log('✅ Core UPP services initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize core services:', error);
  process.exit(1);
}

// Security middleware (must be applied first)
app.use(SecurityMiddleware.enforceHTTPS);
app.use(SecurityMiddleware.requestTracking);
app.use(SecurityMiddleware.deviceFingerprinting);
app.use(SecurityMiddleware.requestSizeLimit(2 * 1024 * 1024)); // 2MB limit

// Enhanced security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.stripe.com"],
      frameSrc: ["https://js.stripe.com", "https://hooks.stripe.com"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

app.use(SecurityMiddleware.contentSecurityPolicy);
app.use(SecurityMiddleware.sanitizeResponse);

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests from allowed origins or same origin
    const allowedOrigins = [
      env.FRONTEND_URL,
      env.CORS_ORIGIN,
      'http://localhost:3000',
      'http://localhost:3001',
      'https://localhost:3000',
      'https://localhost:3001'
    ].filter(Boolean);

    // Allow all ngrok domains for development/testing
    const isNgrokDomain = origin && (
      origin.includes('ngrok-free.app') ||
      origin.includes('ngrok.io') ||
      origin.includes('ngrok.app') ||
      origin.includes('ngrok.com')
    );

    if (!origin || allowedOrigins.includes(origin) || isNgrokDomain) {
      callback(null, true);
    } else {
      console.warn('❌ CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-API-Key',
    'X-Device-ID', 
    'X-Device-Type',
    'X-Request-ID'
  ],
  exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining']
}));

// Rate limiting (general)
app.use(rateLimits.general);

// Serve static files for mobile app
app.use(express.static('public'));

// Body parsing with security validation
app.use(express.json({ 
  limit: '1mb',
  verify: (_req, _res, buf) => {
    try {
      JSON.parse(buf.toString());
    } catch (e) {
      throw new Error('Invalid JSON payload');
    }
  }
}));

// Input sanitization
app.use(SecurityMiddleware.sanitizeInput);
app.use(SecurityMiddleware.validatePaymentData);

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.url;
  const ip = req.ip || req.connection.remoteAddress;
  
  console.log(`[${timestamp}] ${method} ${url} - IP: ${ip}`);
  next();
});

// Error handling middleware
const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction): void => {
  console.error('❌ Server Error:', err);
  
  if (err instanceof z.ZodError) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: err.errors,
      message: 'Invalid request data provided'
    });
    return;
  }
  
  if (err.message === 'Invalid JSON payload') {
    res.status(400).json({
      success: false,
      error: 'Invalid JSON',
      message: 'Request body must be valid JSON'
    });
    return;
  }
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: 'An unexpected error occurred',
    timestamp: new Date().toISOString()
  });
};

// API Routes

// Authentication endpoints
app.post('/api/v1/auth/login', rateLimits.auth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, deviceId } = req.body;
    
    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: 'Missing credentials',
        message: 'Email and password are required'
      });
      return;
    }

    const result = await loginUser(email, password, deviceId);
    
    console.log(`🔐 User logged in: ${email}`);
    
    res.json({
      success: true,
      ...result,
      message: 'Login successful'
    });
  } catch (error: any) {
    console.error('🔐 Login failed:', error.message);
    res.status(401).json({
      success: false,
      error: 'Authentication failed',
      message: 'Invalid email or password'
    });
  }
});

// API Key management endpoints (admin only)
app.post('/api/v1/auth/api-keys', 
  rateLimits.apiKeyGeneration,
  AuthMiddleware.authenticateJWT,
  AuthMiddleware.requireRole('admin'),
  (req: AuthenticatedRequest, res: Response): void => {
    try {
      const { name, permissions = [] } = req.body;
      
      if (!name) {
        res.status(400).json({
          success: false,
          error: 'Missing name',
          message: 'API key name is required'
        });
        return;
      }

      const result = AuthMiddleware.generateApiKey(name, permissions);
      
      console.log(`🔑 API key generated: ${name} by ${req.user?.email}`);
      
      res.json({
        success: true,
        ...result,
        message: 'API key generated successfully'
      });
    } catch (error: any) {
      console.error('🔑 API key generation failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate API key',
        message: error.message
      });
    }
  }
);

app.get('/api/v1/auth/api-keys',
  AuthMiddleware.authenticateJWT,
  AuthMiddleware.requireRole('admin'),
  (_req: AuthenticatedRequest, res: Response): void => {
    const apiKeys = AuthMiddleware.listApiKeys();
    res.json({
      success: true,
      apiKeys,
      message: 'API keys retrieved successfully'
    });
  }
);

// System status endpoint (public)
app.get('/', (_req: Request, res: Response): void => {
  res.json({
    name: 'Universal Payment Protocol',
    version: '2.0.0',
    status: 'operational',
    tagline: 'Secure payments for any internet-connected device',
    timestamp: new Date().toISOString(),
    services: {
      stripe_configured: !!stripeProcessor,
      device_adapters: DeviceAdapterFactory.getSupportedDeviceTypes(),
      security_enabled: true,
      multi_currency: true
    },
    endpoints: {
      process_payment: '/api/v1/payments/process',
      register_device: '/api/v1/devices/register',
      health_check: '/health',
      metrics: '/metrics'
    }
  });
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response): void => {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    services: {
      stripe: !!stripeProcessor,
      device_factory: true,
      security_manager: !!securityManager,
      currency_manager: !!currencyManager
    }
  };
  
  res.json(healthCheck);
});

// Process payment endpoint (requires authentication)
app.post('/api/v1/payments/process', 
  rateLimits.payment,
  AuthMiddleware.optionalAuth,
  AuthMiddleware.requirePermission('payment:process'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Validate input
    const validatedData = PaymentRequestSchema.parse(req.body);
    
    // Security checks
    const deviceId = req.headers['x-device-id'] as string || validatedData.deviceId;
    const ipAddress = req.ip || req.connection.remoteAddress;
    
    // Fraud detection
    const fraudResult = await securityManager.detectFraud(
      validatedData.amount,
      deviceId,
      { 
        ...(ipAddress && { ipAddress }), 
        ...(req.headers['user-agent'] && { userAgent: req.headers['user-agent'] })
      }
    );
    
    if (fraudResult.risk_level === 'critical' || fraudResult.risk_level === 'high') {
      res.status(403).json({
        success: false,
        error: 'Transaction blocked',
        message: 'Security check failed',
        riskScore: fraudResult.risk_score
      });
      return;
    }
    
    // Verify device type is supported
    if (!DeviceAdapterFactory.isDeviceTypeSupported(validatedData.deviceType)) {
      res.status(400).json({
        success: false,
        error: 'Unsupported device type',
        message: `Device type '${validatedData.deviceType}' is not supported`
      });
      return;
    }
    
    const deviceCapabilities = DeviceAdapterFactory.getDeviceCapabilities(validatedData.deviceType);
    
    // Currency conversion if needed
    let finalAmount = validatedData.amount;
    if (validatedData.currency !== 'USD') {
      const conversionResult = await currencyManager.convertCurrency(
        validatedData.amount,
        validatedData.currency,
        'USD'
      );
      finalAmount = conversionResult.converted_amount;
    }
    
    // Process payment through Stripe
    const paymentResult = await stripeProcessor.processDevicePayment({
      amount: finalAmount,
      deviceType: validatedData.deviceType,
      deviceId,
      description: validatedData.description,
      ...(validatedData.customerEmail && { customerEmail: validatedData.customerEmail }),
      metadata: {
        ...validatedData.metadata,
        originalCurrency: validatedData.currency,
        originalAmount: validatedData.amount.toString(),
        riskScore: fraudResult.risk_score.toString(),
        deviceCapabilities: JSON.stringify(deviceCapabilities || {})
      }
    });
    
    console.log(`✅ Payment processed: ${paymentResult.payment_intent_id} - Amount: ${finalAmount} USD`);
    
    res.json({
      ...paymentResult,
      success: true,
      originalAmount: validatedData.amount,
      originalCurrency: validatedData.currency,
      processedAmount: finalAmount,
      processedCurrency: 'USD',
      deviceType: validatedData.deviceType,
      riskScore: fraudResult.risk_score,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    next(error);
  }
});

// Device registration endpoint (requires authentication)
app.post('/api/v1/devices/register',
  rateLimits.deviceRegistration,
  AuthMiddleware.optionalAuth,
  AuthMiddleware.requirePermission('device:register'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Validate input
    const validatedData = DeviceRegistrationSchema.parse(req.body);
    
    // Security validation
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || validatedData.userAgent;
    
    // Device attestation
    const attestationResult = await securityManager.attestDevice(
      validatedData.fingerprint,
      { 
        deviceType: validatedData.deviceType, 
        capabilities: validatedData.capabilities, 
        ...(ipAddress && { ipAddress }),
        ...(userAgent && { userAgent })
      }
    );
    
    if (!attestationResult.known_device && attestationResult.trust_score < 50) {
      res.status(403).json({
        success: false,
        error: 'Device attestation failed',
        message: 'Device could not be verified as legitimate'
      });
      return;
    }
    
    // Generate secure device ID
    const deviceId = `${validatedData.deviceType}_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
    
    // Verify device type is supported
    if (!DeviceAdapterFactory.isDeviceTypeSupported(validatedData.deviceType)) {
      res.status(400).json({
        success: false,
        error: 'Unsupported device type',
        message: `Device type '${validatedData.deviceType}' is not supported`
      });
      return;
    }
    
    const deviceCapabilities = DeviceAdapterFactory.getDeviceCapabilities(validatedData.deviceType);
    
    // Log device registration
    console.log(`📱 Device registered: ${deviceId} (${validatedData.deviceType}) - IP: ${ipAddress}`);
    
    res.json({
      success: true,
      deviceId,
      deviceType: validatedData.deviceType,
      supportedCapabilities: deviceCapabilities || {},
      trustScore: attestationResult.trust_score,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      message: 'Device registered successfully'
    });
    
  } catch (error) {
    next(error);
  }
});

// Device capabilities endpoint
app.get('/api/v1/devices/:deviceType/capabilities', (req: Request, res: Response): void => {
  const { deviceType } = req.params;
  
  if (!deviceType || !DeviceAdapterFactory.getSupportedDeviceTypes().includes(deviceType)) {
    res.status(404).json({
      success: false,
      error: 'Device type not found',
      message: `Device type '${deviceType}' is not supported`
    });
    return;
  }
  
  const deviceCapabilities = DeviceAdapterFactory.getDeviceCapabilities(deviceType!);
  
  res.json({
    success: true,
    deviceType,
    capabilities: deviceCapabilities || {},
    description: `${deviceType} device adapter`
  });
});

// Supported currencies endpoint
app.get('/api/v1/currencies/supported', (_req: Request, res: Response): void => {
  res.json({
    success: true,
    currencies: currencyManager.getSupportedCurrencies(),
    baseCurrency: 'USD',
    lastUpdated: new Date().toISOString()
  });
});

// Metrics endpoint for monitoring
app.get('/metrics', (_req: Request, res: Response): void => {
  const metrics = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    supportedDevices: DeviceAdapterFactory.getSupportedDeviceTypes().length,
    supportedCurrencies: currencyManager.getSupportedCurrencies().length,
    version: '2.0.0'
  };
  
  res.json(metrics);
});

// 404 handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    message: `The endpoint ${req.method} ${req.originalUrl} does not exist`,
    availableEndpoints: [
      'GET /',
      'GET /health',
      'POST /api/v1/payments/process',
      'POST /api/v1/devices/register',
      'GET /api/v1/devices/:deviceType/capabilities',
      'GET /api/v1/currencies/supported',
      'GET /metrics'
    ]
  });
});

// Error handling
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Universal Payment Protocol Server v2.0.0`);
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🔒 Security features enabled`);
  console.log(`💱 Multi-currency support active`);
  console.log(`📱 Supported devices: ${DeviceAdapterFactory.getSupportedDeviceTypes().join(', ')}`);
  console.log(`🌍 Environment: ${env.NODE_ENV}`);
});

export default app;