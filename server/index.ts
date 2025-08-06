// Universal Payment Protocol Server - PRODUCTION READY! 🌊
// Secure, scalable payment processing for any device

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

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

// Request parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(sanitizeInput); // Sanitize all input

// Add authentication routes
app.use('/api/auth', authRoutes);

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

// Stripe Configuration Endpoint (PCI Compliant)
app.get('/api/stripe/config', (req, res) => {
  if (!stripeProcessor) {
    return res.status(503).json({
      success: false,
      error: 'Stripe not configured'
    });
  }
  
  return res.json({
    success: true,
    publishableKey: env.STRIPE_PUBLISHABLE_KEY, // Safe to expose publicly
    environment: env.NODE_ENV
  });
});

// PCI Compliant Card Demo Endpoint
app.get('/demo/pci-card', (req, res) => {
  const cardDemoPath = path.join(__dirname, '../src/modules/payments/card-demo-pci.html');
  
  if (fs.existsSync(cardDemoPath)) {
    res.sendFile(cardDemoPath);
  } else {
    res.status(404).json({
      error: 'PCI compliant card demo not found'
    });
  }
});

// Health check for AWS
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    server: 'AWS',
    message: 'UPP System ALIVE and MAKING MONEY! 🌊💰',
    stripe_ready: !!stripeProcessor
  });
});

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
  
  // Secure payment processing logging
  secureLogger.payment(`Processing ${deviceType} payment`, {
    correlationId: req.correlationId,
    amount,
    deviceType,
    deviceId: deviceId.substring(0, 10) + '...', // Partial device ID for security
    userId: req.user?.userId?.toString(),
    ipAddress: req.ip
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

    // Process payment through Stripe with PCI compliance
    const result = await stripeProcessor.processDevicePayment({
      amount,
      deviceType,
      deviceId,
      description,
      customerEmail,
      metadata,
      paymentMethodId: req.body.paymentMethodId // PCI Compliant: Use tokenized payment method
    });

    // Update transaction with result - handle PCI compliant statuses
    const transactionStatus = result.status === 'requires_confirmation' ? 'pending' : 
                              (result.success ? 'completed' : 'failed');
    
    await transactionRepository.updateStatus(
      transactionId,
      transactionStatus,
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

    // PCI Compliant Audit Trail - Enhanced logging for payment operations
    await auditLogRepository.create({
      user_id: req.user?.userId,
      device_id: deviceId,
      action: 'process_payment',
      resource: 'payment',
      result: result.status === 'requires_confirmation' ? 'success' : (result.success ? 'success' : 'failure'),
      ip_address: req.ip,
      user_agent: req.get('User-Agent'),
      correlation_id: req.correlationId || undefined,
      request_data: { 
        amount, 
        deviceType, 
        description,
        pci_compliant_flow: true,
        payment_method_provided: !!req.body.paymentMethodId,
        requires_confirmation: result.status === 'requires_confirmation'
      },
      response_data: {
        ...result,
        // PCI Compliance: Never log client_secret in audit trail
        client_secret: result.client_secret ? '[REDACTED_CLIENT_SECRET]' : undefined
      },
      sensitive_data_accessed: true // Payment operations always involve sensitive data
    });

    // PCI Compliant Payment Completion Logging
    secureLogger.payment(`Payment ${result.status === 'requires_confirmation' ? 'created for confirmation' : (result.success ? 'completed' : 'failed')}`, {
      correlationId: req.correlationId || undefined,
      transactionId,
      success: result.success,
      status: result.status,
      userId: req.user?.userId?.toString(),
      deviceType,
      amount: (result.success || result.status === 'requires_confirmation') ? amount : undefined,
      pci_compliant: true,
      client_confirmation_required: result.status === 'requires_confirmation'
    });
    
    // PCI Compliant Response
    const responseMessage = result.status === 'requires_confirmation' 
      ? `Payment created for ${deviceType} - client confirmation required`
      : `Payment ${result.success ? 'completed' : 'failed'} for ${deviceType}!`;
    
    res.json({
      ...result,
      transaction_id: transactionId,
      message: responseMessage + ' 🌊'
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
app.get('/api/device/:deviceId', optionalAuth, asyncHandler(async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
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
      'GET /api/auth/me (protected)'
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
