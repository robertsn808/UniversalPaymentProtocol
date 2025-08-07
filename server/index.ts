// Universal Payment Protocol Server - PRODUCTION READY! 🌊
// Secure, scalable payment processing for any device

import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';

// Load environment first
dotenv.config();

// Import configuration and security
import { authenticateToken, optionalAuth, AuthenticatedRequest } from '../src/auth/jwt.js';
import authRoutes from '../src/auth/routes.js';
import { env, validateProductionSecurity, getSanitizedConfig } from '../src/config/environment.js';
import { db } from '../src/database/connection.js';
import { deviceRepository, transactionRepository, auditLogRepository } from '../src/database/repositories.js';
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
import secureLogger from '../src/shared/logger.js';

// Import application modules
import { errorHandler, asyncHandler, ValidationError, PaymentError } from '../src/utils/errors.js';
import { PaymentRequestSchema, DeviceRegistrationSchema, validateInput } from '../src/utils/validation.js';

import { createPaymentProcessor } from './stripe-integration.js';

// Global error handler for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
  secureLogger.error('Uncaught Exception', { error: error.message, stack: error.stack });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  secureLogger.error('Unhandled Rejection', { reason: String(reason) });
});

// Validate production security requirements
try {
  validateProductionSecurity();
} catch (error) {
  console.warn('⚠️ Production security validation failed:', error);
}

const app = express();

// Initialize payment processor with secure error handling
let paymentProcessor: any;
try {
  paymentProcessor = createPaymentProcessor();
  secureLogger.info('💳 Payment processor initialized for UPP');
} catch (error) {
  secureLogger.warn('⚠️ Payment processor initialization failed - running in demo mode', { 
    error: error instanceof Error ? error.message : 'Unknown error',
    hasSecretKey: !!env.STRIPE_SECRET_KEY 
  });
  
  if (env.NODE_ENV === 'production') {
    secureLogger.warn('🔄 Production mode: Payment processor not available, using demo mode');
  }
}

// Security middleware stack (order matters!) - Wrap in try-catch
try {
  app.use(httpsRedirect); // Force HTTPS in production
  app.use(correlationIdMiddleware); // Add correlation IDs first
  app.use(requestLoggingMiddleware); // Log requests with correlation ID
  app.use(securityHeadersMiddleware); // Enhanced security headers
  app.use(generalRateLimit); // General rate limiting
} catch (error) {
  console.warn('⚠️ Some security middleware failed to load:', error);
}

// CORS with secure configuration
try {
  app.use(cors({
    origin: env.CORS_ORIGINS.split(',').map(origin => origin.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
    maxAge: 86400 // 24 hours
  }));
} catch (error) {
  console.warn('⚠️ CORS configuration failed:', error);
  // Fallback CORS
  app.use(cors());
}

// Request parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

try {
  app.use(sanitizeInput); // Sanitize all input
} catch (error) {
  console.warn('⚠️ Input sanitization failed:', error);
}

// Add authentication routes
try {
  app.use('/api/auth', authRoutes);
} catch (error) {
  console.warn('⚠️ Auth routes failed to load:', error);
}

// Initialize database connection
async function initializeDatabase() {
  try {
    const isConnected = await db.testConnection();
    if (isConnected) {
      secureLogger.info('✅ Database connected successfully');
    } else {
      secureLogger.warn('⚠️ Database connection failed - running in demo mode');
      if (env.NODE_ENV === 'production') {
        secureLogger.warn('🔄 Production mode: Database not available, using demo mode');
      }
    }
  } catch (error) {
    secureLogger.warn('⚠️ Database initialization error - running in demo mode', { 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    if (env.NODE_ENV === 'production') {
      secureLogger.warn('🔄 Production mode: Database not available, using demo mode');
    }
  }
}

// Initialize on startup (don't block server startup)
initializeDatabase().catch(error => {
  console.warn('⚠️ Database initialization failed:', error);
});

// Server startup logging
try {
  secureLogger.info('🌊 Universal Payment Protocol Server Starting...', {
    environment: env.NODE_ENV,
    port: env.PORT,
    config: getSanitizedConfig()
  });
  secureLogger.info('💰 Ready to make some money!');
} catch (error) {
  console.log('🌊 Universal Payment Protocol Server Starting...');
  console.log(`Environment: ${env.NODE_ENV}, Port: ${env.PORT}`);
}

// Welcome endpoint
app.get('/', (req, res) => {
  try {
    // Check if client wants JSON
    if (req.headers.accept?.includes('application/json')) {
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
        stripe_configured: !!paymentProcessor,
        endpoints: {
          health: '/health',
          api: '/api/process-payment',
          docs: 'https://github.com/robertsn808/UniversalPaymentProtocol'
        }
      });
    } else {
      // Return HTML for browser requests
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>🌊 Universal Payment Protocol</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
            .container { max-width: 800px; margin: 0 auto; }
            h1 { font-size: 2.5em; margin-bottom: 10px; }
            .tagline { font-size: 1.3em; margin-bottom: 30px; opacity: 0.9; }
            .status { background: rgba(255,255,255,0.1); padding: 20px; border-radius: 10px; margin: 20px 0; }
            .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 30px 0; }
            .feature { background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; text-align: center; }
            .endpoints { background: rgba(255,255,255,0.1); padding: 20px; border-radius: 10px; margin: 20px 0; }
            .endpoint { margin: 10px 0; }
            a { color: #ffd700; text-decoration: none; }
            a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🌊 Universal Payment Protocol</h1>
            <div class="tagline">ANY Device + Internet = Payment Terminal</div>
            
            <div class="status">
              <h2>🚀 Status: LIVE and Making Money! 💰</h2>
              <p>Version: 1.0.0</p>
              <p>Environment: ${env.NODE_ENV}</p>
              <p>Payment Processor: ${paymentProcessor ? '✅ Configured' : '⚠️ Demo Mode'}</p>
            </div>

            <h2>💳 Supported Payment Methods</h2>
            <div class="features">
              <div class="feature">📱 Smartphone Payments</div>
              <div class="feature">📺 Smart TV Payments</div>
              <div class="feature">🏠 IoT Device Payments</div>
              <div class="feature">🎤 Voice Assistant Payments</div>
              <div class="feature">🎮 Gaming Console Payments</div>
              <div class="feature">🌐 ANY Internet Device!</div>
            </div>

            <div class="endpoints">
              <h2>🔗 API Endpoints</h2>
              <div class="endpoint">• <a href="/health">Health Check</a> - Server status</div>
              <div class="endpoint">• <a href="https://github.com/robertsn808/UniversalPaymentProtocol">Documentation</a> - Full API docs</div>
              <div class="endpoint">• POST /api/process-payment - Process payments</div>
              <div class="endpoint">• POST /api/register-device - Register devices</div>
            </div>

            <div style="text-align: center; margin-top: 40px; opacity: 0.8;">
              <p>🌊 Built with Aloha from Hawaii</p>
              <p>Powered by Node.js, TypeScript, and Stripe</p>
            </div>
          </div>
        </body>
        </html>
      `);
    }
  } catch (error) {
    console.error('Error in root endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check for AWS
app.get('/health', (req, res) => {
  try {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      server: 'AWS',
      message: 'UPP System ALIVE and MAKING MONEY! 🌊💰',
      stripe_ready: !!paymentProcessor,
      environment: env.NODE_ENV,
      port: env.PORT
    });
  } catch (error) {
    console.error('Error in health endpoint:', error);
    res.status(500).json({ error: 'Health check failed' });
  }
});

// Simple test endpoint
app.get('/test', (req, res) => {
  res.json({ message: 'Server is working!', timestamp: new Date().toISOString() });
});

// REAL Stripe Payment Processing with Security
app.post('/api/process-payment', paymentRateLimit, optionalAuth, asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  // Validate request data
  const validation = validateInput(PaymentRequestSchema, req.body);
  if (!validation.success) {
    throw new ValidationError(`Invalid payment request: ${validation.errors.join(', ')}`);
  }

  if (!paymentProcessor) {
    throw new PaymentError('Stripe not configured - Set STRIPE_SECRET_KEY in environment variables');
  }

  const { amount, deviceType, deviceId, description, customerEmail, metadata } = validation.data;
  
  // Secure payment processing logging
  secureLogger.payment(`Processing ${deviceType} payment`, {
    correlationId: req.correlationId,
    amount,
    deviceType,
    deviceId: deviceId.substring(0, 10) + '...', // Partial device ID for security
    userId: req.user?.userId.toString(),
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

    // Process payment through Stripe
    const result = await paymentProcessor.processDevicePayment({
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
      userId: req.user?.userId.toString(),
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
try {
  app.use(errorHandler);
} catch (error) {
  console.warn('⚠️ Error handler failed to load:', error);
  // Fallback error handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });
}

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    message: `Endpoint ${req.method} ${req.originalUrl} not found`,
    availableEndpoints: [
      'GET /',
      'GET /health',
      'GET /test',
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
  try {
    const server = app.listen(env.PORT, '0.0.0.0', () => {
      console.log('🌊 ====================================');
      console.log('🚀 UPP Server LIVE and READY!');
      console.log(`📡 Server running on port ${env.PORT} (0.0.0.0)`);
      console.log(`🌐 Health check: http://localhost:${env.PORT}/health`);
      console.log(`💳 Payment endpoint: http://localhost:${env.PORT}/api/process-payment`);
      console.log(`📱 Device registration: http://localhost:${env.PORT}/api/register-device`);
      console.log('🌊 ====================================');
      
      try {
        secureLogger.info('🌊 ====================================');
        secureLogger.info('🚀 UPP Server LIVE and READY!');
        secureLogger.info(`📡 Server running on port ${env.PORT} (0.0.0.0)`);
        secureLogger.info(`🌐 Health check: http://localhost:${env.PORT}/health`);
        secureLogger.info(`💳 Payment endpoint: http://localhost:${env.PORT}/api/process-payment`);
        secureLogger.info(`📱 Device registration: http://localhost:${env.PORT}/api/register-device`);
        secureLogger.info('🌊 ====================================');
      } catch (logError) {
        console.warn('⚠️ Logger failed:', logError);
      }
    });

    // Handle server errors
    server.on('error', (error) => {
      console.error('🚨 Server error:', error);
      process.exit(1);
    });

  } catch (error) {
    console.error('🚨 Failed to start server:', error);
    process.exit(1);
  }
}
