// Universal Payment Protocol Server - PRODUCTION READY! 🌊
// Secure, scalable payment processing for any device

import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

// Load environment first
dotenv.config();

// Import configuration and security
import { env, validateProductionSecurity, getSanitizedConfig } from '../src/config/environment.js';
import secureLogger from '../src/shared/logger.js';
import {
  correlationIdMiddleware,
  securityHeadersMiddleware,
  generalRateLimit,
  paymentRateLimit,
  authRateLimit,
  sanitizeInput,
  requestSizeLimit,
  httpsRedirect,
  requestLoggingMiddleware
} from '../src/middleware/security.js';

// Import application modules
import { UPPStripeProcessor } from './stripe-integration.js';
import { PaymentRequestSchema, DeviceRegistrationSchema, validateInput } from '../src/utils/validation.js';
import { errorHandler, asyncHandler, ValidationError, PaymentError } from '../src/utils/errors.js';
import { db } from '../src/database/connection.js';
import { deviceRepository, transactionRepository, auditLogRepository } from '../src/database/repositories.js';
import { authenticateToken, optionalAuth, AuthenticatedRequest } from '../src/auth/jwt.js';
import authRoutes from '../src/auth/routes.js';
import { stripeWebhookHandler } from '../src/webhooks/stripeWebhookHandler.js';
import { healthCheckService } from '../src/monitoring/HealthCheck.js';
import { metricsCollector } from '../src/monitoring/MetricsCollector.js';
import { performanceMiddleware, responseTimeMiddleware } from '../src/middleware/performance.js';
import { paymentFlowManager } from '../src/business/PaymentFlowManager.js';
import { fraudDetectionSystem } from '../src/business/FraudDetection.js';
import { advancedRateLimiter } from '../src/middleware/advancedRateLimit.js';

// Validate production security requirements
validateProductionSecurity();

const app = express();

// Initialize Stripe processor with secure error handling
let stripeProcessor: UPPStripeProcessor;
try {
  stripeProcessor = new UPPStripeProcessor();
  secureLogger.info('💳 Stripe processor initialized for UPP');
} catch (error) {
  secureLogger.error('⚠️ Stripe initialization failed', { 
    error: error instanceof Error ? error.message : 'Unknown error',
    hasSecretKey: !!env.STRIPE_SECRET_KEY 
  });
  
  if (env.NODE_ENV === 'production') {
    process.exit(1); // Don't start server without payment processor in production
  }
}

// Security middleware stack (order matters!)
app.use(httpsRedirect); // Force HTTPS in production
app.use(correlationIdMiddleware); // Add correlation IDs first
app.use(requestLoggingMiddleware); // Log requests with correlation ID
app.use(securityHeadersMiddleware); // Enhanced security headers
app.use(generalRateLimit); // General rate limiting

// CORS with secure configuration
app.use(cors({
  origin: env.CORS_ORIGINS.split(',').map(origin => origin.trim()),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
  maxAge: 86400 // 24 hours
}));

// Stripe webhook endpoint (needs raw body, before JSON parsing)
app.post('/api/webhooks/stripe', 
  express.raw({ type: 'application/json' }),
  asyncHandler(async (req: Request, res: Response) => {
    await stripeWebhookHandler.handleWebhook(req, res);
  })
);

// Request parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(sanitizeInput); // Sanitize all input

// Performance monitoring middleware
app.use(performanceMiddleware);
app.use(responseTimeMiddleware);

// Advanced rate limiting middleware
app.use(advancedRateLimiter.createMiddleware());

// Add authentication routes
app.use('/api/auth', authRoutes);

// Add card payment routes
import cardPaymentRoutes from '../src/modules/payments/card-routes.js';
app.use('/api/card', cardPaymentRoutes);

// Initialize database connection
async function initializeDatabase() {
  try {
    const isConnected = await db.testConnection();
    if (isConnected) {
      secureLogger.info('✅ Database connected successfully');
    } else {
      secureLogger.error('❌ Database connection failed');
      if (env.NODE_ENV === 'production') {
        process.exit(1);
      }
    }
  } catch (error) {
    secureLogger.error('❌ Database initialization error', { 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    if (env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
}

// Initialize on startup
initializeDatabase();

// Server startup logging
secureLogger.info('🌊 Universal Payment Protocol Server Starting...', {
  environment: env.NODE_ENV,
  port: env.PORT,
  config: getSanitizedConfig()
});
secureLogger.info('💰 Ready to make some money!');

// Welcome endpoint
app.get('/', (req, res) => {
  res.json({
    message: '🌊 Universal Payment Protocol - LIVE!',
    tagline: 'ANY Device + Internet = Payment Terminal',
    version: '1.0.0',
    status: 'Making Money! 💰',
    features: [
      'Smartphone Payments',
      'Smart TV Payments', 
      'IoT Device Payments',
      'Voice Assistant Payments',
      'ANY Internet Device!'
    ],
    stripe_configured: !!stripeProcessor
  });
});

// Health check endpoints
app.get('/health', asyncHandler(async (req: Request, res: Response) => {
  await healthCheckService.handleHealthCheck(req, res);
}));

// Simple health check for load balancers
app.get('/ping', asyncHandler(async (req: Request, res: Response) => {
  await healthCheckService.handleSimpleHealth(req, res);
}));

// Metrics endpoints
app.get('/metrics', asyncHandler(async (req: Request, res: Response) => {
  await metricsCollector.handleMetricsEndpoint(req, res);
}));

// Prometheus metrics endpoint
app.get('/metrics/prometheus', asyncHandler(async (req: Request, res: Response) => {
  await metricsCollector.handlePrometheusMetrics(req, res);
}));

// Serve NFC test page
app.get('/nfc-test', generalRateLimit, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/nfc-test.html'));
});

// Serve card payment demo page
app.get('/card-demo', generalRateLimit, (req, res) => {
  res.sendFile(path.join(__dirname, '../src/modules/payments/card-demo.html'));
});

// NFC payment endpoint for web-based NFC testing
app.post('/api/nfc-payment', asyncHandler(async (req: Request, res: Response) => {
  const { amount, nfcData, merchant, merchantId } = req.body as {
    amount: string;
    nfcData: { type?: string } | string;
    merchant: string;
    merchantId: string;
  };
  
  // Create UPP payment request from NFC data
  const paymentRequest = {
    amount: parseFloat(amount),
    deviceType: 'smartphone',
    deviceId: `web_nfc_${Date.now()}`,
    description: `NFC Payment - ${merchant}`,
    metadata: {
      businessType: 'retail',
      paymentMethod: 'nfc',
      nfcData,
      merchantId,
      webNFC: true
    }
  };
  
  secureLogger.info('Processing Web NFC payment', {
    amount: parseFloat(amount),
    merchant: merchant,
    nfcType: typeof nfcData === 'object' ? nfcData.type : 'string'
  });
  
  // For demo purposes, simulate successful payment
  const transactionId = `txn_nfc_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  
  res.json({
    success: true,
    transactionId,
    amount: parseFloat(amount),
    currency: 'USD',
    merchant,
    timestamp: new Date().toISOString(),
    nfcType: typeof nfcData === 'object' ? nfcData.type || 'simulated' : 'simulated',
    receipt: {
      merchant,
      location: 'Web NFC Test',
      timestamp: new Date().toISOString()
    }
  });
}));

// REAL Stripe Payment Processing with Security
app.post('/api/process-payment', paymentRateLimit, optionalAuth, asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  // Validate request data
  const validation = validateInput(PaymentRequestSchema, req.body);
  if (!validation.success) {
    throw new ValidationError(`Invalid payment request: ${validation.errors.join(', ')}`);
  }

  if (!stripeProcessor) {
    throw new PaymentError('Stripe not configured - Set STRIPE_SECRET_KEY in environment variables');
  }

  const { amount, deviceType, deviceId, description, customerEmail, metadata } = validation.data;
  
  // Create business payment request
  const businessPaymentRequest = {
    amount,
    currency: 'USD',
    deviceId,
    deviceType,
    customerEmail,
    description,
    businessType: metadata?.businessType || 'retail',
    paymentMethod: metadata?.paymentMethod || 'card',
    metadata: {
      ...metadata,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      correlationId: req.correlationId
    }
  };

  // Business validation
  await paymentFlowManager.validateBusinessPayment(businessPaymentRequest);

  // Fraud detection
  const fraudScore = await fraudDetectionSystem.assessFraudRisk(businessPaymentRequest);
  
  if (fraudScore.shouldBlock) {
    throw new PaymentError(`Payment blocked due to fraud risk: ${fraudScore.reasons.join(', ')}`);
  }

  if (fraudScore.requiresManualReview) {
    // Log for manual review but don't block immediately
    secureLogger.warn('Payment requires manual review', {
      deviceId: deviceId.substring(0, 10) + '...',
      fraudScore: fraudScore.score,
      reasons: fraudScore.reasons
    });
  }
  
  // Secure payment processing logging
  secureLogger.payment(`Processing ${deviceType} payment`, {
    correlationId: req.correlationId,
    amount,
    deviceType,
    deviceId: deviceId.substring(0, 10) + '...', // Partial device ID for security
    userId: req.user?.userId?.toString(),
    ipAddress: req.ip,
    fraudScore: fraudScore.score,
    fraudLevel: fraudScore.level
  });

  // Generate transaction ID
  const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  
  try {
    // Create transaction record in database
    const transaction = await transactionRepository.create({
      id: transactionId,
      user_id: req.user?.userId,
      device_id: deviceId,
      amount,
      currency: 'USD',
      status: 'processing',
      payment_method: deviceType,
      description,
      metadata
    });

    // Process payment through Stripe
    const result = await stripeProcessor.processDevicePayment({
      amount,
      deviceType,
      deviceId,
      description,
      customerEmail,
      metadata
    });

    // Update transaction with result
    await transactionRepository.updateStatus(
      transactionId,
      result.success ? 'completed' : 'failed',
      result.error_message
    );

    // Update device last seen
    try {
      await deviceRepository.updateLastSeen(deviceId);
    } catch (error) {
      // Device might not exist in database, continue
      secureLogger.warn('Device not found in database during payment', {
        correlationId: req.correlationId || undefined,
        deviceId: deviceId.substring(0, 10) + '...',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Log audit trail
    await auditLogRepository.create({
      user_id: req.user?.userId,
      device_id: deviceId,
      action: 'process_payment',
      resource: 'payment',
      result: result.success ? 'success' : 'failure',
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
      correlation_id: req.correlationId || undefined,
      request_data: { amount, deviceType, description },
      response_data: result,
      sensitive_data_accessed: false
    });

    // Secure payment completion logging
    secureLogger.payment(`Payment ${result.success ? 'completed' : 'failed'}`, {
      correlationId: req.correlationId || undefined,
      transactionId,
      success: result.success,
      userId: req.user?.userId?.toString(),
      deviceType,
      amount: result.success ? amount : undefined // Only log amount on success
    });
    
    res.json({
      ...result,
      transaction_id: transactionId,
      message: `Payment ${result.success ? 'completed' : 'failed'} for ${deviceType}! 🌊`
    });
  } catch (error) {
    // Update transaction status to failed
    await transactionRepository.updateStatus(transactionId, 'failed', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
}));

// Device Registration Endpoint
app.post('/api/register-device', optionalAuth, asyncHandler(async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  // Validate request data
  const validation = validateInput(DeviceRegistrationSchema, req.body);
  if (!validation.success) {
    throw new ValidationError(`Invalid device registration: ${validation.errors.join(', ')}`);
  }

  const { deviceType, capabilities, fingerprint, securityContext } = validation.data;
  
  console.log(`📱 Registering ${deviceType} device`);

  // Check if device already exists by fingerprint
  const existingDevice = await deviceRepository.findByFingerprint(fingerprint);
  if (existingDevice) {
    // Update existing device
    await deviceRepository.update(existingDevice.id, {
      capabilities,
      security_context: securityContext || { encryption_level: 'basic' },
      last_seen: new Date(),
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    // Log audit trail
    await auditLogRepository.create({
      user_id: req.user?.userId,
      device_id: existingDevice.id,
      action: 'update_device',
      resource: 'device',
      result: 'success',
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
      correlation_id: req.correlationId || undefined,
      request_data: { deviceType, capabilities },
      sensitive_data_accessed: false
    });

    console.log(`✅ Device updated successfully: ${existingDevice.id}`);
    
    res.json({
      success: true,
      deviceId: existingDevice.id,
      message: 'Device updated successfully',
      device: existingDevice
    });
    return;
  }

  // Generate unique device ID
  const deviceId = `${deviceType}_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  
  // Create device in database
  const device = await deviceRepository.create({
    id: deviceId,
    user_id: req.user?.userId,
    device_type: deviceType,
    fingerprint,
    capabilities,
    security_context: securityContext || { encryption_level: 'basic' },
    status: 'active',
    last_seen: new Date(),
    ip_address: req.ip,
    user_agent: req.get('User-Agent')
  });

  // Log audit trail
  await auditLogRepository.create({
    user_id: req.user?.userId,
    device_id: deviceId,
    action: 'register_device',
    resource: 'device',
    result: 'success',
    ip_address: req.ip,
    user_agent: req.get('User-Agent'),
    correlation_id: req.correlationId,
    request_data: { deviceType, capabilities },
    sensitive_data_accessed: false
  });

  console.log(`✅ Device registered successfully: ${deviceId}`);
  
  res.json({
    success: true,
    deviceId,
    message: 'Device registered successfully',
    device
  });
}));

// Get Device Status Endpoint
app.get('/api/device/:deviceId', authRateLimit, optionalAuth, asyncHandler(async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {


  const { deviceId } = req.params;
  
  if (!deviceId) {
    res.status(400).json({
      success: false,
      error: 'Device ID is required'
    });
    return;
  }
  
  const device = await deviceRepository.findById(deviceId);
  if (!device) {
    res.status(404).json({
      success: false,
      error: 'Device not found'
    });
    return;
  }

  // Check if user owns this device (if authenticated)
  if (req.user && device.user_id !== req.user.userId) {
    res.status(403).json({
      success: false,
      error: 'Access denied to this device'
    });
    return;
  }

  res.json({
    success: true,
    device
  });
}));

// List Registered Devices Endpoint
app.get('/api/devices', optionalAuth, asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { page = 1, limit = 10, status, device_type } = req.query;
  
  // Build filter options
  const filters: any = {};
  if (req.user) {
    filters.user_id = req.user.userId; // Only show user's devices if authenticated
  }
  if (status) {
    filters.status = status as string;
  }
  if (device_type) {
    filters.device_type = device_type as string;
  }

  const devices = await deviceRepository.findMany({
    filters,
    page: Number(page),
    limit: Number(limit)
  });

  // Log audit trail
  await auditLogRepository.create({
    user_id: req.user?.userId,
    action: 'list_devices',
    resource: 'device',
    result: 'success',
    ip_address: req.ip,
    user_agent: req.get('User-Agent'),
    correlation_id: req.correlationId,
    request_data: { page, limit, status, device_type },
    response_data: { device_count: devices.length },
    sensitive_data_accessed: false
  });

  res.json({
    success: true,
    devices,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: devices.length
    },
    message: `Retrieved ${devices.length} devices`
  });
}));

// Transaction Status Endpoint
app.get('/api/transaction/:transactionId', optionalAuth, asyncHandler(async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  const { transactionId } = req.params;
  
  if (!transactionId) {
    res.status(400).json({
      success: false,
      error: 'Transaction ID is required'
    });
    return;
  }
  
  const transaction = await transactionRepository.findById(transactionId);
  if (!transaction) {
    res.status(404).json({
      success: false,
      error: 'Transaction not found'
    });
    return;
  }

  // Check if user owns this transaction (if authenticated)
  if (req.user && transaction.user_id !== req.user.userId) {
    res.status(403).json({
      success: false,
      error: 'Access denied to this transaction'
    });
    return;
  }

  // Log audit trail
  await auditLogRepository.create({
    user_id: req.user?.userId,
    action: 'view_transaction',
    resource: 'transaction',
    result: 'success',
    ip_address: req.ip,
    user_agent: req.get('User-Agent'),
    correlation_id: req.correlationId,
    request_data: { transactionId },
    response_data: { transaction_status: transaction.status },
    sensitive_data_accessed: true // Transaction data is sensitive
  });

  res.json({
    success: true,
    transaction,
    message: 'Transaction status retrieved successfully'
  });
}));

// Protected routes requiring authentication
app.get('/api/user/devices', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { page = 1, limit = 10, status, device_type } = req.query;
  
  const devices = await deviceRepository.findMany({
    filters: { user_id: req.user!.userId, status, device_type },
    page: Number(page),
    limit: Number(limit)
  });

  res.json({
    success: true,
    devices,
    pagination: { page: Number(page), limit: Number(limit), total: devices.length }
  });
}));

app.get('/api/user/transactions', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { page = 1, limit = 10, status } = req.query;
  
  const transactions = await transactionRepository.findByUserId(req.user!.userId, {
    status: status as string,
    page: Number(page),
    limit: Number(limit)
  });

  res.json({
    success: true,
    transactions,
    pagination: { page: Number(page), limit: Number(limit), total: transactions.length }
  });
}));

// Use our custom error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    message: `Endpoint ${req.method} ${req.originalUrl} not found`,
    availableEndpoints: [
      'GET /',
      'GET /health',
      'POST /api/process-payment',
      'POST /api/register-device',
      'GET /api/device/:deviceId',
      'GET /api/devices',
      'GET /api/transaction/:transactionId',
      'GET /api/user/devices (protected)',
      'GET /api/user/transactions (protected)',
      'POST /api/auth/register',
      'POST /api/auth/login',
      'POST /api/auth/refresh',
      'POST /api/auth/logout',
      'GET /api/auth/me (protected)',
      'POST /api/webhooks/stripe'
    ]
  });
});

// Export app for testing
export { app };

// Start server only if not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(env.PORT, () => {
    secureLogger.info('🌊 ====================================');
    secureLogger.info('🚀 UPP Server LIVE and READY!');
    secureLogger.info(`📡 Server running on port ${env.PORT}`);
    secureLogger.info(`🌐 Health check: http://localhost:${env.PORT}/health`);
    secureLogger.info(`💳 Payment endpoint: http://localhost:${env.PORT}/api/process-payment`);
    secureLogger.info(`📱 Device registration: http://localhost:${env.PORT}/api/register-device`);
    secureLogger.info('🌊 ====================================');
  });
}
