import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { UPPStripeProcessor } from './stripe-integration.js';
import { DeviceAdapterFactory } from '../src/modules/universal-payment-protocol/devices/DeviceAdapterFactory.js';
import { SecurityManagerAdapter } from './SecurityManagerAdapter.js';
import { CurrencyManager } from '../src/modules/universal-payment-protocol/currency/CurrencyManager.js';

// Security middleware imports
import {
  validateEnvironment,
  securityHeadersMiddleware,
  corsMiddleware,
  rateLimitMiddleware,
  paymentRateLimitMiddleware,
  sanitizeInput,
  validateRequest,
  enforceHTTPS,
  validateContentType,
  limitRequestSize,
  securityErrorHandler,
  logSecurityEvent
} from './middleware/security.js';

import {
  authenticateAPIKey,
  authenticateDevice,
  optionalAuth,
  generateSecureAPIKey,
  AuthenticatedRequest
} from './middleware/auth.js';

import {
  deviceRegistrationSchema,
  paymentProcessingSchema
} from '../src/config/security.js';

import { redactSensitiveData } from '../src/utils/encryption.js';

// Load and validate environment variables first
dotenv.config();
const env = validateEnvironment();

const app = express();
const PORT = env.PORT;

// Trust proxy for production deployment
if (env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Initialize core services with secure configuration
let stripeProcessor: UPPStripeProcessor;
let securityManager: SecurityManagerAdapter;
let currencyManager: CurrencyManager;

try {
  stripeProcessor = new UPPStripeProcessor();
  securityManager = new SecurityManagerAdapter();
  currencyManager = new CurrencyManager();
  console.log('✅ Core UPP services initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize core services:', redactSensitiveData(error));
  process.exit(1);
}

// Apply security middleware in the correct order
app.use(enforceHTTPS); // Force HTTPS in production
app.use(securityHeadersMiddleware); // Security headers
app.use(corsMiddleware); // CORS protection
app.use(rateLimitMiddleware); // General rate limiting
app.use(limitRequestSize(1024 * 1024)); // 1MB request size limit
app.use(validateContentType); // Content-Type validation
app.use(express.json({ 
  limit: '1mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf.toString());
    } catch (e) {
      throw new Error('Invalid JSON payload');
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(sanitizeInput); // Input sanitization (after body parsing)

// Request logging middleware (with sensitive data redaction)
app.use((req: Request, res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl;
  const ip = req.ip || req.connection.remoteAddress;
  
  console.log(`[${timestamp}] ${method} ${url} - IP: ${ip}`);
  
  // Log request body in development (redacted)
  if (env.NODE_ENV === 'development' && req.body) {
    console.log('Request body:', redactSensitiveData(req.body));
  }
  
  next();
});

// Error handling middleware
const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('❌ Server Error:', err);
  
  if (err.name === 'ZodError') {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: err.errors,
      message: 'Invalid request data provided'
    });
  }
  
  if (err.message === 'Invalid JSON payload') {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON',
      message: 'Request body must be valid JSON'
    });
  }
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: 'An unexpected error occurred',
    timestamp: new Date().toISOString()
  });
};

// API Routes

// System status endpoint
app.get('/', (req: Request, res: Response) => {
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
app.get('/health', (req: Request, res: Response) => {
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

// Process payment endpoint (secured with API key + device auth + payment rate limiting)
app.post('/api/v1/payments/process', 
  paymentRateLimitMiddleware,
  authenticateAPIKey,
  authenticateDevice,
  validateRequest(paymentProcessingSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Data is already validated by validateRequest middleware
    const validatedData = req.body;
    
    // Security checks
    const deviceId = req.headers['x-device-id'] as string || validatedData.deviceId;
    const ipAddress = req.ip || req.connection.remoteAddress;
    
    // Fraud detection
    const fraudResult = await securityManager.detectFraud(
      validatedData.amount,
      deviceId,
      { ipAddress, userAgent: req.headers['user-agent'] }
    );
    
    if (fraudResult.risk_level === 'critical' || fraudResult.risk_level === 'high') {
      return res.status(403).json({
        success: false,
        error: 'Transaction blocked',
        message: 'Security check failed',
        riskScore: fraudResult.risk_score
      });
    }
    
    // Verify device type is supported
    if (!DeviceAdapterFactory.isDeviceTypeSupported(validatedData.deviceType)) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported device type',
        message: `Device type '${validatedData.deviceType}' is not supported`
      });
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
      customerEmail: validatedData.customerEmail,
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

// Device registration endpoint (secured with API key)
app.post('/api/v1/devices/register',
  authenticateAPIKey,
  validateRequest(deviceRegistrationSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Data is already validated by validateRequest middleware
    const validatedData = req.body;
    
    // Security validation
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || validatedData.userAgent;
    
    // Device attestation
    const attestationResult = await securityManager.attestDevice(
      validatedData.fingerprint,
      { deviceType: validatedData.deviceType, capabilities: validatedData.capabilities, ipAddress, userAgent }
    );
    
    if (!attestationResult.known_device && attestationResult.trust_score < 50) {
      return res.status(403).json({
        success: false,
        error: 'Device attestation failed',
        message: 'Device could not be verified as legitimate'
      });
    }
    
    // Generate cryptographically secure device ID
    const deviceId = `${validatedData.deviceType}_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
    
    // Verify device type is supported
    if (!DeviceAdapterFactory.isDeviceTypeSupported(validatedData.deviceType)) {
      return res.status(400).json({
        success: false,
        error: 'Unsupported device type',
        message: `Device type '${validatedData.deviceType}' is not supported`
      });
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
app.get('/api/v1/devices/:deviceType/capabilities', (req: Request, res: Response) => {
  const { deviceType } = req.params;
  
  if (!DeviceAdapterFactory.getSupportedDeviceTypes().includes(deviceType)) {
    return res.status(404).json({
      success: false,
      error: 'Device type not found',
      message: `Device type '${deviceType}' is not supported`
    });
  }
  
  const deviceCapabilities = DeviceAdapterFactory.getDeviceCapabilities(deviceType);
  
  res.json({
    success: true,
    deviceType,
    capabilities: deviceCapabilities || {},
    description: `${deviceType} device adapter`
  });
});

// Supported currencies endpoint
app.get('/api/v1/currencies/supported', (req: Request, res: Response) => {
  res.json({
    success: true,
    currencies: currencyManager.getSupportedCurrencies(),
    baseCurrency: 'USD',
    lastUpdated: new Date().toISOString()
  });
});

// Metrics endpoint for monitoring
app.get('/metrics', (req: Request, res: Response) => {
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

// Error handling (use secure error handler)
app.use(securityErrorHandler);

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
  
  // Security startup checks
  if (env.NODE_ENV === 'production') {
    console.log(`✅ HTTPS enforcement enabled`);
    console.log(`✅ API key authentication required`);
    console.log(`✅ Input validation active`);
    console.log(`✅ Rate limiting configured`);
  } else {
    console.warn(`⚠️  Development mode - some security features relaxed`);
  }
});

export default app;