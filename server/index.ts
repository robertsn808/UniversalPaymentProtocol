// Kai's Universal Payment Protocol Server - PRODUCTION READY! 🌊
// Let's make some money! 💰

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { UPPStripeProcessor } from './stripe-integration.js';
import { PaymentRequestSchema, DeviceRegistrationSchema, validateInput } from '../src/utils/validation.js';
import { errorHandler, asyncHandler, ValidationError, PaymentError } from '../src/utils/errors.js';
import { db } from '../src/database/connection.js';
import { deviceRepository, transactionRepository, auditLogRepository } from '../src/database/repositories.js';
import { authenticateToken, optionalAuth, AuthenticatedRequest } from '../src/auth/jwt.js';
import authRoutes from '../src/auth/routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Stripe processor
let stripeProcessor: UPPStripeProcessor;
try {
  stripeProcessor = new UPPStripeProcessor();
} catch (error) {
  console.error('⚠️  Stripe not configured. Set STRIPE_SECRET_KEY in .env file');
}

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Add authentication routes
app.use('/api/auth', authRoutes);

// Initialize database connection
async function initializeDatabase() {
  try {
    const isConnected = await db.testConnection();
    if (isConnected) {
      console.log('✅ Database connected successfully');
    } else {
      console.error('❌ Database connection failed');
    }
  } catch (error) {
    console.error('❌ Database initialization error:', error);
  }
}

// Initialize on startup
initializeDatabase();

console.log('🌊 Kai\'s UPP Server Starting...');
console.log('💰 Ready to make some money!');

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

// REAL Stripe Payment Processing
app.post('/api/process-payment', optionalAuth, asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  // Validate request data
  const validation = validateInput(PaymentRequestSchema, req.body);
  if (!validation.success) {
    throw new ValidationError(`Invalid payment request: ${validation.errors.join(', ')}`);
  }

  if (!stripeProcessor) {
    throw new PaymentError('Stripe not configured - Set STRIPE_SECRET_KEY in environment variables');
  }

  const { amount, deviceType, deviceId, description, customerEmail, metadata } = validation.data;
  
  console.log(`💳 Processing ${deviceType} payment: $${amount}`);

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
      console.warn(`Device ${deviceId} not found in database`);
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
      correlation_id: req.correlationId,
      request_data: { amount, deviceType, description },
      response_data: result,
      sensitive_data_accessed: false
    });

    console.log(`✅ Payment ${result.success ? 'completed' : 'failed'}: ${transactionId}`);
    
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
app.post('/api/register-device', optionalAuth, asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
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
      correlation_id: req.correlationId,
      request_data: { deviceType, capabilities },
      sensitive_data_accessed: false
    });

    console.log(`✅ Device updated successfully: ${existingDevice.id}`);
    
    return res.json({
      success: true,
      deviceId: existingDevice.id,
      message: 'Device updated successfully',
      device: existingDevice
    });
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
app.get('/api/device/:deviceId', optionalAuth, asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { deviceId } = req.params;
  
  const device = await deviceRepository.findById(deviceId);
  if (!device) {
    return res.status(404).json({
      success: false,
      error: 'Device not found'
    });
  }

  // Check if user owns this device (if authenticated)
  if (req.user && device.user_id !== req.user.userId) {
    return res.status(403).json({
      success: false,
      error: 'Access denied to this device'
    });
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
app.get('/api/transaction/:transactionId', optionalAuth, asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  const { transactionId } = req.params;
  
  const transaction = await transactionRepository.findById(transactionId);
  if (!transaction) {
    return res.status(404).json({
      success: false,
      error: 'Transaction not found'
    });
  }

  // Check if user owns this transaction (if authenticated)
  if (req.user && transaction.user_id !== req.user.userId) {
    return res.status(403).json({
      success: false,
      error: 'Access denied to this transaction'
    });
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
  app.listen(PORT, () => {
    console.log('🌊 ====================================');
    console.log('🚀 UPP Server LIVE and READY!');
    console.log(`📡 Server running on port ${PORT}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/health`);
    console.log(`💳 Payment endpoint: http://localhost:${PORT}/api/process-payment`);
    console.log(`📱 Device registration: http://localhost:${PORT}/api/register-device`);
    console.log('🌊 ====================================');
  });
}
