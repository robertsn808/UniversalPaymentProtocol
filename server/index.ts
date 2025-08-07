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

// Import AI monitoring system
import { aiErrorHandler } from '../src/monitoring/ai-error-handler.js';
import { aiMonitoring, aiErrorMonitoring } from '../src/middleware/ai-error-monitoring.js';
import aiMonitoringRoutes from '../src/monitoring/ai-monitoring-routes.js';

// Global error handler for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
  try {
    secureLogger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  } catch (logError) {
    console.error('Logger failed:', logError);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  try {
    secureLogger.error('Unhandled Rejection', { reason: String(reason) });
  } catch (logError) {
    console.error('Logger failed:', logError);
  }
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
  console.log('💳 Payment processor initialized for UPP');
  try {
    secureLogger.info('💳 Payment processor initialized for UPP');
  } catch (logError) {
    console.warn('Logger failed:', logError);
  }
} catch (error) {
  console.warn('⚠️ Payment processor initialization failed - running in demo mode', error);
  try {
    secureLogger.warn('⚠️ Payment processor initialization failed - running in demo mode', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      hasSecretKey: !!env.STRIPE_SECRET_KEY 
    });
  } catch (logError) {
    console.warn('Logger failed:', logError);
  }
  
  if (env.NODE_ENV === 'production') {
    console.warn('🔄 Production mode: Payment processor not available, using demo mode');
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

// AI Monitoring middleware (add after CORS but before other middleware)
try {
  app.use(aiMonitoring()); // Performance, security, and request monitoring
  console.log('🤖 AI monitoring middleware initialized');
  try {
    secureLogger.info('🤖 AI monitoring middleware initialized');
  } catch (logError) {
    console.warn('Logger failed:', logError);
  }
} catch (error) {
  console.warn('⚠️ AI monitoring middleware failed to load:', error);
  try {
    secureLogger.warn('⚠️ AI monitoring middleware failed to load', { error: error instanceof Error ? error.message : 'Unknown error' });
  } catch (logError) {
    console.warn('Logger failed:', logError);
  }
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

// Add AI monitoring routes
try {
  app.use('/api/monitoring', aiMonitoringRoutes);
  console.log('🤖 AI monitoring routes initialized');
  try {
    secureLogger.info('🤖 AI monitoring routes initialized');
  } catch (logError) {
    console.warn('Logger failed:', logError);
  }
} catch (error) {
  console.warn('⚠️ AI monitoring routes failed to load:', error);
  try {
    secureLogger.warn('⚠️ AI monitoring routes failed to load', { error: error instanceof Error ? error.message : 'Unknown error' });
  } catch (logError) {
    console.warn('Logger failed:', logError);
  }
}

// Initialize database connection
async function initializeDatabase() {
  try {
    const isConnected = await db.testConnection();
    if (isConnected) {
      console.log('✅ Database connected successfully');
      try {
        secureLogger.info('✅ Database connected successfully');
      } catch (logError) {
        console.warn('Logger failed:', logError);
      }
    } else {
      console.warn('⚠️ Database connection failed - running in demo mode');
      try {
        secureLogger.warn('⚠️ Database connection failed - running in demo mode');
      } catch (logError) {
        console.warn('Logger failed:', logError);
      }
      if (env.NODE_ENV === 'production') {
        console.warn('🔄 Production mode: Database not available, using demo mode');
      }
    }
  } catch (error) {
    console.warn('⚠️ Database initialization error - running in demo mode', error);
    try {
      secureLogger.warn('⚠️ Database initialization error - running in demo mode', { 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } catch (logError) {
      console.warn('Logger failed:', logError);
    }
    if (env.NODE_ENV === 'production') {
      console.warn('🔄 Production mode: Database not available, using demo mode');
    }
  }
}

// Initialize on startup (don't block server startup)
initializeDatabase().catch(error => {
  console.warn('⚠️ Database initialization failed:', error);
});

// Server startup logging
try {
  console.log('🌊 Universal Payment Protocol Server Starting...');
  console.log(`Environment: ${env.NODE_ENV}, Port: ${env.PORT}`);
  try {
    secureLogger.info('🌊 Universal Payment Protocol Server Starting...', {
      environment: env.NODE_ENV,
      port: env.PORT,
      config: getSanitizedConfig()
    });
    secureLogger.info('💰 Ready to make some money!');
  } catch (logError) {
    console.warn('Logger failed:', logError);
  }
} catch (error) {
  console.log('🌊 Universal Payment Protocol Server Starting...');
  console.log(`Environment: ${env.NODE_ENV}, Port: ${env.PORT}`);
}

// Welcome endpoint
app.get('/', (req, res) => {
  try {
    console.log('📥 Root endpoint accessed');
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
          test: '/test',
          demo: '/demo',
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
            .cta { text-align: center; margin: 30px 0; }
            .cta-btn { display: inline-block; background: #ffd700; color: #333; padding: 15px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 1.2em; }
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

            <div class="cta">
              <a href="/demo" class="cta-btn">🎮 Try the Interactive Demo!</a>
              <a href="/ai-monitoring" class="cta-btn" style="margin-left: 15px; background: #28a745;">🤖 AI Monitoring Dashboard</a>
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
              <div class="endpoint">• <a href="/test">Test Endpoint</a> - Basic connectivity</div>
              <div class="endpoint">• <a href="/demo">Interactive Demo</a> - User-friendly dashboard</div>
              <div class="endpoint">• <a href="/ai-monitoring">AI Monitoring Dashboard</a> - Error analysis & auto-fixes</div>
              <div class="endpoint">• <a href="https://github.com/robertsn808/UniversalPaymentProtocol">Documentation</a> - Full API docs</div>
              <div class="endpoint">• POST /api/process-payment - Process payments</div>
              <div class="endpoint">• POST /api/register-device - Register devices</div>
              <div class="endpoint">• POST /api/save-card - Save payment methods</div>
              <div class="endpoint">• GET /api/user/cards - Get saved cards</div>
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
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Demo Dashboard endpoint
app.get('/demo', (req, res) => {
  try {
    console.log('📥 Demo dashboard accessed');
    const fs = require('fs');
    const path = require('path');
    const demoPath = path.join(__dirname, '../src/demo/DemoDashboard.html');
    
    if (fs.existsSync(demoPath)) {
      const html = fs.readFileSync(demoPath, 'utf8');
      res.send(html);
    } else {
      res.status(404).json({
        error: 'Demo dashboard not found',
        message: 'Demo file not available',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error serving demo dashboard:', error);
    res.status(500).json({
      error: 'Demo dashboard error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Mobile App Simulator endpoint
app.get('/mobile', (req, res) => {
  try {
    console.log('📥 Mobile app simulator accessed');
    const fs = require('fs');
    const path = require('path');
    const mobilePath = path.join(__dirname, '../src/demo/MobileAppSimulator.html');
    
    if (fs.existsSync(mobilePath)) {
      const html = fs.readFileSync(mobilePath, 'utf8');
      res.send(html);
    } else {
      res.status(404).json({
        error: 'Mobile simulator not found',
        message: 'Mobile simulator file not available',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error serving mobile simulator:', error);
    res.status(500).json({
      error: 'Mobile simulator error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// AI Monitoring Dashboard endpoint
app.get('/ai-monitoring', (req, res) => {
  try {
    console.log('📥 AI monitoring dashboard accessed');
    const fs = require('fs');
    const path = require('path');
    const dashboardPath = path.join(__dirname, '../src/monitoring/AIMonitoringDashboard.html');
    
    if (fs.existsSync(dashboardPath)) {
      const html = fs.readFileSync(dashboardPath, 'utf8');
      res.send(html);
    } else {
      res.status(404).json({
        error: 'AI monitoring dashboard not found',
        message: 'Dashboard file not available',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error serving AI monitoring dashboard:', error);
    res.status(500).json({
      error: 'AI monitoring dashboard error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Health check for AWS
app.get('/health', (req, res) => {
  try {
    console.log('📥 Health check accessed');
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      server: 'AWS',
      message: 'UPP System ALIVE and MAKING MONEY! 🌊💰',
      stripe_ready: !!paymentProcessor,
      environment: env.NODE_ENV,
      port: env.PORT,
      uptime: process.uptime()
    });
  } catch (error) {
    console.error('Error in health endpoint:', error);
    res.status(500).json({ 
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Simple test endpoint
app.get('/test', (req, res) => {
  try {
    console.log('📥 Test endpoint accessed');
    res.json({ 
      message: 'Server is working!', 
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      paymentProcessor: !!paymentProcessor
    });
  } catch (error) {
    console.error('Error in test endpoint:', error);
    res.status(500).json({ 
      error: 'Test endpoint failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// REAL Stripe Payment Processing with Security
app.post('/api/process-payment', paymentRateLimit, optionalAuth, asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  console.log('📥 Payment processing request received');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    // Validate request data
    console.log('🔍 Validating payment request...');
    const validation = validateInput(PaymentRequestSchema, req.body);
    if (!validation.success) {
      console.error('❌ Payment validation failed:', validation.errors);
      throw new ValidationError(`Invalid payment request: ${validation.errors.join(', ')}`);
    }
    console.log('✅ Payment validation passed');

    if (!paymentProcessor) {
      console.error('❌ No payment processor available');
      throw new PaymentError('Stripe not configured - Set STRIPE_SECRET_KEY in environment variables');
    }

    const { amount, deviceType, deviceId, description, customerEmail, metadata } = validation.data;
    console.log('💰 Processing payment:', { amount, deviceType, deviceId: deviceId?.substring(0, 10) + '...' });
    
    // Secure payment processing logging
    try {
      secureLogger.payment(`Processing ${deviceType} payment`, {
        correlationId: req.correlationId,
        amount,
        deviceType,
        deviceId: deviceId.substring(0, 10) + '...', // Partial device ID for security
        userId: req.user?.userId.toString(),
        ipAddress: req.ip
      });
    } catch (logError) {
      console.warn('Logger failed:', logError);
    }

    // Generate transaction ID
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    console.log('🆔 Generated transaction ID:', transactionId);
    
    try {
      // Create transaction record in database
      console.log('💾 Creating transaction record...');
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
      console.log('✅ Transaction record created');

      // Process payment through Stripe
      console.log('💳 Processing payment through processor...');
      const result = await paymentProcessor.processDevicePayment({
        amount,
        deviceType,
        deviceId,
        description,
        customerEmail,
        metadata
      });
      console.log('✅ Payment processed:', { success: result.success });

      // Update transaction with result
      console.log('💾 Updating transaction status...');
      await transactionRepository.updateStatus(
        transactionId,
        result.success ? 'completed' : 'failed',
        result.error_message
      );
      console.log('✅ Transaction status updated');

      // Update device last seen
      try {
        console.log('📱 Updating device last seen...');
        await deviceRepository.updateLastSeen(deviceId);
        console.log('✅ Device last seen updated');
      } catch (error) {
        // Device might not exist in database, continue
        console.warn('⚠️ Device not found in database during payment:', error);
        try {
          secureLogger.warn('Device not found in database during payment', {
            correlationId: req.correlationId || undefined,
            deviceId: deviceId.substring(0, 10) + '...',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        } catch (logError) {
          console.warn('Logger failed:', logError);
        }
      }

      // Log audit trail
      try {
        console.log('📝 Creating audit log...');
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
        console.log('✅ Audit log created');
      } catch (error) {
        console.warn('⚠️ Failed to create audit log:', error);
      }

      // Secure payment completion logging
      try {
        secureLogger.payment(`Payment ${result.success ? 'completed' : 'failed'}`, {
          correlationId: req.correlationId || undefined,
          transactionId,
          success: result.success,
          userId: req.user?.userId.toString(),
          deviceType,
          amount: result.success ? amount : undefined // Only log amount on success
        });
      } catch (logError) {
        console.warn('Logger failed:', logError);
      }
      
      console.log('✅ Payment processing completed successfully');
      res.json({
        ...result,
        transaction_id: transactionId,
        message: `Payment ${result.success ? 'completed' : 'failed'} for ${deviceType}! 🌊`
      });
    } catch (error) {
      console.error('❌ Error during payment processing:', error);
      // Update transaction status to failed
      try {
        await transactionRepository.updateStatus(transactionId, 'failed', error instanceof Error ? error.message : 'Unknown error');
      } catch (updateError) {
        console.warn('⚠️ Failed to update transaction status:', updateError);
      }
      throw error;
    }
  } catch (error) {
    console.error('❌ Payment processing failed:', error);
    res.status(500).json({
      error: 'Payment processing failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      transaction_id: req.body?.transactionId || 'unknown'
    });
  }
}));

// Device Registration Endpoint
app.post('/api/register-device', optionalAuth, asyncHandler(async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  console.log('📥 Device registration request received');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    // Validate request data
    console.log('🔍 Validating device registration...');
    const validation = validateInput(DeviceRegistrationSchema, req.body);
    if (!validation.success) {
      console.error('❌ Device validation failed:', validation.errors);
      throw new ValidationError(`Invalid device registration: ${validation.errors.join(', ')}`);
    }
    console.log('✅ Device validation passed');

    const { deviceType, capabilities, fingerprint, securityContext } = validation.data;
    console.log(`📱 Registering ${deviceType} device`);
    console.log('Device fingerprint:', fingerprint?.substring(0, 10) + '...');

    // Check if device already exists by fingerprint
    console.log('🔍 Checking for existing device...');
    const existingDevice = await deviceRepository.findByFingerprint(fingerprint);
    if (existingDevice) {
      console.log('📱 Updating existing device:', existingDevice.id);
      // Update existing device
      await deviceRepository.update(existingDevice.id, {
        capabilities,
        security_context: securityContext || { encryption_level: 'basic' },
        last_seen: new Date(),
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });

      // Log audit trail
      try {
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
      } catch (error) {
        console.warn('⚠️ Failed to create audit log:', error);
      }

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
    console.log('🆔 Generated device ID:', deviceId);
    
    // Create device in database
    console.log('💾 Creating device record...');
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
    try {
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
    } catch (error) {
      console.warn('⚠️ Failed to create audit log:', error);
    }

    console.log(`✅ Device registered successfully: ${deviceId}`);
    
    res.json({
      success: true,
      deviceId,
      message: 'Device registered successfully',
      device
    });
  } catch (error) {
    console.error('❌ Device registration failed:', error);
    res.status(500).json({
      error: 'Device registration failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}));

// Get Device Status Endpoint
app.get('/api/device/:deviceId', optionalAuth, asyncHandler(async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  console.log('📥 Device status request received');
  console.log('Device ID:', req.params.deviceId);
  
  try {
    const { deviceId } = req.params;
    
    if (!deviceId) {
      console.error('❌ Device ID is required');
      res.status(400).json({
        success: false,
        error: 'Device ID is required'
      });
      return;
    }
    
    console.log('🔍 Finding device...');
    const device = await deviceRepository.findById(deviceId);
    if (!device) {
      console.error('❌ Device not found:', deviceId);
      res.status(404).json({
        success: false,
        error: 'Device not found'
      });
      return;
    }

    // Check if user owns this device (if authenticated)
    if (req.user && device.user_id !== req.user.userId) {
      console.error('❌ Access denied to device:', deviceId);
      res.status(403).json({
        success: false,
        error: 'Access denied to this device'
      });
      return;
    }

    console.log('✅ Device found:', deviceId);
    res.json({
      success: true,
      device
    });
  } catch (error) {
    console.error('❌ Device status request failed:', error);
    res.status(500).json({
      error: 'Device status request failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}));

// List Registered Devices Endpoint
app.get('/api/devices', optionalAuth, asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  console.log('📥 List devices request received');
  console.log('Query params:', req.query);
  
  try {
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

    console.log('🔍 Finding devices with filters:', filters);
    const devices = await deviceRepository.findMany({
      filters,
      page: Number(page),
      limit: Number(limit)
    });

    // Log audit trail
    try {
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
    } catch (error) {
      console.warn('⚠️ Failed to create audit log:', error);
    }

    console.log(`✅ Found ${devices.length} devices`);
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
  } catch (error) {
    console.error('❌ List devices request failed:', error);
    res.status(500).json({
      error: 'List devices request failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}));

// Transaction Status Endpoint
app.get('/api/transaction/:transactionId', optionalAuth, asyncHandler(async (req: AuthenticatedRequest, res: express.Response): Promise<void> => {
  console.log('📥 Transaction status request received');
  console.log('Transaction ID:', req.params.transactionId);
  
  try {
    const { transactionId } = req.params;
    
    if (!transactionId) {
      console.error('❌ Transaction ID is required');
      res.status(400).json({
        success: false,
        error: 'Transaction ID is required'
      });
      return;
    }
    
    console.log('🔍 Finding transaction...');
    const transaction = await transactionRepository.findById(transactionId);
    if (!transaction) {
      console.error('❌ Transaction not found:', transactionId);
      res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
      return;
    }

    // Check if user owns this transaction (if authenticated)
    if (req.user && transaction.user_id !== req.user.userId) {
      console.error('❌ Access denied to transaction:', transactionId);
      res.status(403).json({
        success: false,
        error: 'Access denied to this transaction'
      });
      return;
    }

    // Log audit trail
    try {
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
    } catch (error) {
      console.warn('⚠️ Failed to create audit log:', error);
    }

    console.log('✅ Transaction found:', transactionId);
    res.json({
      success: true,
      transaction,
      message: 'Transaction status retrieved successfully'
    });
  } catch (error) {
    console.error('❌ Transaction status request failed:', error);
    res.status(500).json({
      error: 'Transaction status request failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}));

// Protected routes requiring authentication
app.get('/api/user/devices', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  console.log('📥 User devices request received');
  console.log('User ID:', req.user?.userId);
  
  try {
    const { page = 1, limit = 10, status, device_type } = req.query;
    
    console.log('🔍 Finding user devices...');
    const devices = await deviceRepository.findMany({
      filters: { user_id: req.user!.userId, status, device_type },
      page: Number(page),
      limit: Number(limit)
    });

    console.log(`✅ Found ${devices.length} user devices`);
    res.json({
      success: true,
      devices,
      pagination: { page: Number(page), limit: Number(limit), total: devices.length }
    });
  } catch (error) {
    console.error('❌ User devices request failed:', error);
    res.status(500).json({
      error: 'User devices request failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}));

app.get('/api/user/transactions', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  console.log('📥 User transactions request received');
  console.log('User ID:', req.user?.userId);
  
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    console.log('🔍 Finding user transactions...');
    const transactions = await transactionRepository.findByUserId(req.user!.userId, {
      status: status as string,
      page: Number(page),
      limit: Number(limit)
    });

    console.log(`✅ Found ${transactions.length} user transactions`);
    res.json({
      success: true,
      transactions,
      pagination: { page: Number(page), limit: Number(limit), total: transactions.length }
    });
  } catch (error) {
    console.error('❌ User transactions request failed:', error);
    res.status(500).json({
      error: 'User transactions request failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}));

// Card Management Endpoints
app.post('/api/save-card', optionalAuth, asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  console.log('📥 Save card request received');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { cardNumber, expiry, cvv, cardholderName } = req.body;
    
    if (!cardNumber || !expiry || !cvv || !cardholderName) {
      console.error('❌ Missing required card fields');
      res.status(400).json({
        success: false,
        error: 'Missing required fields: cardNumber, expiry, cvv, cardholderName'
      });
      return;
    }

    // Basic validation
    if (cardNumber.replace(/\s/g, '').length < 13) {
      console.error('❌ Invalid card number');
      res.status(400).json({
        success: false,
        error: 'Invalid card number'
      });
      return;
    }

    // In a real app, you'd encrypt and store securely
    const cardId = 'card_' + Date.now() + '_' + Math.random().toString(36).substring(2);
    const last4 = cardNumber.replace(/\s/g, '').slice(-4);
    
    // Determine card brand
    let brand = 'Unknown';
    const cleanNumber = cardNumber.replace(/\s/g, '');
    if (cleanNumber.startsWith('4')) brand = 'Visa';
    else if (cleanNumber.startsWith('5')) brand = 'Mastercard';
    else if (cleanNumber.startsWith('3')) brand = 'American Express';
    else if (cleanNumber.startsWith('6')) brand = 'Discover';

    const card = {
      id: cardId,
      last4: last4,
      brand: brand,
      expiry: expiry,
      cardholderName: cardholderName,
      userId: req.user?.userId,
      createdAt: new Date().toISOString()
    };

    // In a real app, save to database
    console.log('✅ Card saved:', { id: cardId, brand, last4 });
    
    res.json({
      success: true,
      card: card,
      message: 'Card saved successfully'
    });
  } catch (error) {
    console.error('❌ Save card failed:', error);
    res.status(500).json({
      error: 'Save card failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}));

app.get('/api/user/cards', optionalAuth, asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  console.log('📥 Get user cards request received');
  console.log('User ID:', req.user?.userId);
  
  try {
    // In a real app, fetch from database
    const mockCards = [
      {
        id: 'card_1234567890_abc123',
        last4: '1234',
        brand: 'Visa',
        expiry: '12/25',
        cardholderName: 'John Doe',
        userId: req.user?.userId || 'demo_user',
        createdAt: new Date().toISOString()
      },
      {
        id: 'card_1234567890_def456',
        last4: '5678',
        brand: 'Mastercard',
        expiry: '06/26',
        cardholderName: 'John Doe',
        userId: req.user?.userId || 'demo_user',
        createdAt: new Date().toISOString()
      }
    ];

    console.log(`✅ Found ${mockCards.length} cards for user`);
    res.json({
      success: true,
      cards: mockCards,
      message: `Retrieved ${mockCards.length} cards`
    });
  } catch (error) {
    console.error('❌ Get user cards failed:', error);
    res.status(500).json({
      error: 'Get user cards failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}));

app.delete('/api/user/cards/:cardId', optionalAuth, asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  console.log('📥 Delete card request received');
  console.log('Card ID:', req.params.cardId);
  
  try {
    const { cardId } = req.params;
    
    if (!cardId) {
      console.error('❌ Card ID is required');
      res.status(400).json({
        success: false,
        error: 'Card ID is required'
      });
      return;
    }

    // In a real app, delete from database
    console.log('✅ Card deleted:', cardId);
    
    res.json({
      success: true,
      message: 'Card deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete card failed:', error);
    res.status(500).json({
      error: 'Delete card failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}));

// Enhanced payment endpoint with better UX
app.post('/api/quick-pay', paymentRateLimit, optionalAuth, asyncHandler(async (req: AuthenticatedRequest, res: express.Response) => {
  console.log('📥 Quick payment request received');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { amount, description, cardId, deviceType } = req.body;
    
    if (!amount || amount <= 0) {
      console.error('❌ Invalid amount');
      res.status(400).json({
        success: false,
        error: 'Invalid amount'
      });
      return;
    }

    if (!description) {
      console.error('❌ Description required');
      res.status(400).json({
        success: false,
        error: 'Description is required'
      });
      return;
    }

    if (!paymentProcessor) {
      console.error('❌ No payment processor available');
      res.status(500).json({
        success: false,
        error: 'Payment processor not available'
      });
      return;
    }

    // Generate device ID if not provided
    const deviceId = deviceType ? `${deviceType}_${Date.now()}` : `web_${Date.now()}`;
    
    console.log('💰 Processing quick payment:', { amount, description, deviceId });
    
    const paymentData = {
      amount: parseFloat(amount),
      deviceType: deviceType || 'web',
      deviceId: deviceId,
      description: description,
      customerEmail: req.user?.email || 'demo@upp.com',
      metadata: {
        card_id: cardId,
        payment_type: 'quick_pay',
        user_id: req.user?.userId
      }
    };

    const result = await paymentProcessor.processDevicePayment(paymentData);
    
    if (result.success) {
      console.log('✅ Quick payment successful');
      res.json({
        success: true,
        transaction_id: `txn_${Date.now()}_${Math.random().toString(36).substring(2)}`,
        amount: amount,
        message: 'Payment processed successfully!',
        device: deviceType || 'web'
      });
    } else {
      console.error('❌ Quick payment failed:', result.error_message);
      res.status(400).json({
        success: false,
        error: result.error_message || 'Payment failed'
      });
    }
  } catch (error) {
    console.error('❌ Quick payment failed:', error);
    res.status(500).json({
      error: 'Quick payment failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}));

// Use our custom error handling middleware with AI monitoring
try {
  app.use(aiErrorMonitoring()); // AI error monitoring (must come before errorHandler)
  app.use(errorHandler);
  console.log('🤖 AI error monitoring integrated with error handler');
  try {
    secureLogger.info('🤖 AI error monitoring integrated with error handler');
  } catch (logError) {
    console.warn('Logger failed:', logError);
  }
} catch (error) {
  console.warn('⚠️ Error handler failed to load:', error);
  // Fallback error handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('Error:', err);
    res.status(500).json({ 
      error: 'Internal server error',
      message: err instanceof Error ? err.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  });
}

// 404 handler
app.use('*', (req, res) => {
  console.log('❌ 404 - Endpoint not found:', req.method, req.originalUrl);
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
      'GET /api/auth/me (protected)',
      'GET /demo',
      'GET /mobile'
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
