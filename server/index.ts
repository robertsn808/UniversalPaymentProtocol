import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

import { createPaymentProcessor } from '../src/payments/payment-processor-factory.js';
import { universalPaymentGateway } from '../src/payments/universal-payment-gateway.js';
import { multiCurrencySystem } from '../src/payments/multi-currency.js';
import { auditTrail } from '../src/compliance/audit-trail.js';
import secureLogger from '../src/shared/logger.js';
import { env } from '../src/config/environment.js';
import authRoutes from '../src/auth/routes.js';

// Request validation schemas
const PaymentRequestSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  description: z.string(),
  customer_email: z.string().email().optional(),
  customer_name: z.string().optional(),
  payment_method: z.enum(['card', 'bank_transfer', 'digital_wallet']).default('card'),
  card_data: z.object({
    number: z.string().optional(),
    exp_month: z.string().optional(),
    exp_year: z.string().optional(),
    cvv: z.string().optional(),
    token: z.string().optional(),
    holder_name: z.string().optional()
  }).optional(),
  metadata: z.record(z.any()).optional()
});

const DevicePaymentSchema = z.object({
  amount: z.number().positive(),
  deviceType: z.string(),
  deviceId: z.string(),
  description: z.string(),
  customerEmail: z.string().email().optional(),
  customerName: z.string().optional(),
  cardData: z.object({
    number: z.string().optional(),
    token: z.string().optional(),
    exp_month: z.string().optional(),
    exp_year: z.string().optional(),
    cvv: z.string().optional()
  }).optional(),
  metadata: z.record(z.any()).optional()
});

const app = express();

// Initialize payment processor
const paymentProcessor = createPaymentProcessor();
console.log('🌊 UPP Server initialized with native payment processing');

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-domain.com'] 
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static('src/demo'));
app.use(express.static('src/modules/payments'));
app.use(express.static('src/monitoring'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// Authentication routes
app.use('/api/auth', authRoutes);

// Payment rate limiting (stricter)
const paymentLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // limit each IP to 10 payment requests per 5 minutes
  message: 'Too many payment requests, please try again later.',
});

// Welcome route
app.get('/', (req, res) => {
  res.json({
    message: '🌊 Universal Payment Protocol - LIVE!',
    tagline: 'ANY Device + Internet = Payment Terminal',
    version: '1.0.0',
    status: 'operational',
    endpoints: {
      health: '/health',
      payment: '/api/process-payment',
      demo: '/card-demo.html',
      dashboard: '/DemoDashboard.html',
      landing: '/UPPLandingPage.html'
    },
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'Universal Payment Protocol',
    version: '1.0.0',
    payment_processor: 'Visa Direct',
    timestamp: new Date().toISOString()
  });
});

// Process standard payment
app.post('/api/process-payment', paymentLimiter, async (req, res) => {
  const correlationId = `req_${Date.now()}_${Math.random().toString(36).substring(2)}`;

  try {
    secureLogger.info('Payment request received', {
      correlationId,
      amount: req.body.amount,
      currency: req.body.currency,
      paymentMethod: req.body.payment_method
    });

    // Validate request
    const validatedData = PaymentRequestSchema.parse(req.body);

    // Add merchant_id
    const paymentRequest = {
      ...validatedData,
      merchant_id: 'UPP_MERCHANT_001'
    };

    // Process payment
    const result = await paymentProcessor.processPayment(paymentRequest);

    // Log audit trail
    await auditTrail.logPaymentEvent({
      user_id: validatedData.customer_email || 'anonymous',
      action: result.success ? 'payment_success' : 'payment_failure',
      transaction_id: result.transaction_id,
      amount: validatedData.amount,
      currency: validatedData.currency,
      ip_address: req.ip,
      correlation_id: correlationId,
    });

    secureLogger.info('Payment processed', {
      correlationId,
      transactionId: result.transaction_id,
      success: result.success,
      status: result.status
    });

    res.json(result);

  } catch (error) {
    secureLogger.error('Payment processing error', {
      correlationId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Payment processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// Process device payment
app.post('/api/process-device-payment', paymentLimiter, async (req, res) => {
  const correlationId = `device_${Date.now()}_${Math.random().toString(36).substring(2)}`;

  try {
    secureLogger.info('Device payment request received', {
      correlationId,
      deviceType: req.body.deviceType,
      amount: req.body.amount
    });

    // Validate request
    const validatedData = DevicePaymentSchema.parse(req.body);

    // Convert to internal format
    const devicePaymentRequest = {
      amount: validatedData.amount,
      device_type: validatedData.deviceType,
      device_id: validatedData.deviceId,
      description: validatedData.description,
      customer_email: validatedData.customerEmail,
      customer_name: validatedData.customerName,
      card_data: validatedData.cardData,
      metadata: validatedData.metadata
    };

    // Process payment
    const result = await paymentProcessor.processDevicePayment(devicePaymentRequest);
    
    // Log audit trail
    await auditTrail.logPaymentEvent({
      user_id: validatedData.customerEmail || 'anonymous',
      action: result.success ? 'device_payment_success' : 'device_payment_failure',
      transaction_id: result.transaction_id,
      amount: validatedData.amount,
      device_type: validatedData.deviceType,
      device_id: validatedData.deviceId,
      ip_address: req.ip,
      correlation_id: correlationId,
    });

    secureLogger.info('Device payment processed', {
      correlationId,
      transactionId: result.transaction_id,
      success: result.success,
      deviceType: validatedData.deviceType
    });

    res.json(result);

  } catch (error) {
    secureLogger.error('Device payment processing error', {
      correlationId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid device payment request',
        details: error.errors
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Device payment processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// Create payment intent
app.post('/api/payment-intents', async (req, res) => {
  try {
    const { amount, currency = 'USD', customer_email, description, metadata } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount'
      });
    }

    const intent = await universalPaymentGateway.createPaymentIntent({
      amount,
      currency,
      customer_email,
      description,
      metadata
    });

    secureLogger.info('Payment intent created', {
      intentId: intent.id,
      amount,
      currency
    });

    res.json({
      success: true,
      payment_intent: intent
    });

  } catch (error) {
    secureLogger.error('Payment intent creation failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      success: false,
      error: 'Failed to create payment intent'
    });
  }
});

// Confirm payment intent
app.post('/api/payment-intents/:id/confirm', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate payment intent ID format
    if (!id || !/^pi_[a-zA-Z0-9]+$/.test(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid payment intent ID format'
      });
    }
    
    const { payment_method_data } = req.body;

    const intent = await universalPaymentGateway.confirmPaymentIntent(id, payment_method_data);

    secureLogger.info('Payment intent confirmed', {
      intentId: id,
      status: intent.status
    });

    res.json({
      success: true,
      payment_intent: intent
    });

  } catch (error) {
    secureLogger.error('Payment intent confirmation failed', {
      intentId: req.params.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Payment confirmation failed'
    });
  }
});

// Create customer
app.post('/api/customers', async (req, res) => {
  try {
    const CustomerSchema = z.object({
      email: z.string().email('Invalid email format'),
      name: z.string().optional(),
      metadata: z.record(z.any()).optional()
    });
    
    // Validate request
    const validatedData = CustomerSchema.parse(req.body);

    const customer = await paymentProcessor.createCustomer(validatedData);

    const customer = await paymentProcessor.createCustomer({ email, name, metadata });

    secureLogger.info('Customer created', {
      customerId: customer.id,
      email
    });

    res.json({
      success: true,
      customer
    });

  } catch (error) {
    secureLogger.error('Customer creation failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      success: false,
      error: 'Failed to create customer'
    });
  }
});

// Create payment method
app.post('/api/payment-methods', async (req, res) => {
  try {
    const { type, customer_id, card } = req.body;

    if (type !== 'card' || !card) {
      return res.status(400).json({
        success: false,
        error: 'Only card payment methods are currently supported'
      });
    }

    const paymentMethod = await paymentProcessor.createPaymentMethod({
      type,
      customer_id,
      card
    });

    // Don't log sensitive card data
    secureLogger.info('Payment method created', {
      paymentMethodId: paymentMethod.id,
      type,
      lastFour: card.number?.slice(-4) || 'unknown'
    });

    res.json({
      success: true,
      payment_method: paymentMethod
    });

  } catch (error) {
    secureLogger.error('Payment method creation failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      success: false,
      error: 'Failed to create payment method'
    });
  }
});

// Get payment status
app.get('/api/payments/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const payment = await paymentProcessor.getPaymentStatus(id);

    res.json({
      success: true,
      payment
    });

  } catch (error) {
    secureLogger.error('Failed to get payment status', {
      paymentId: req.params.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(404).json({
      success: false,
      error: 'Payment not found'
    });
  }
});

// Process refund
app.post('/api/refunds', async (req, res) => {
  try {
    const { payment_intent_id, transaction_id, amount, reason } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Refund amount must be positive'
      });
    }

    if (!payment_intent_id && !transaction_id) {
      return res.status(400).json({
        success: false,
        error: 'payment_intent_id or transaction_id is required'
      });
    }

    const refund = await paymentProcessor.refundPayment({
      payment_intent_id,
      transaction_id,
      amount,
      reason
    });

    secureLogger.info('Refund processed', {
      refundId: refund.id,
      amount: refund.amount,
      status: refund.status
    });

    res.json({
      success: true,
      refund
    });

  } catch (error) {
    secureLogger.error('Refund processing failed', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      success: false,
      error: 'Failed to process refund'
    });
  }
});

// Multi-currency endpoints

// Get supported currencies
app.get('/api/currencies', (req, res) => {
  const currencies = multiCurrencySystem.getSupportedPaymentMethods('USD');

  res.json({
    success: true,
    supported_currencies: [
      'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'SEK', 'NZD',
      'BRL', 'MXN', 'INR', 'KRW', 'SGD', 'HKD', 'NOK', 'PLN', 'TRY', 'ZAR'
    ],
    payment_methods: currencies
  });
});

// Get exchange rate
app.get('/api/exchange-rate/:from/:to', async (req, res) => {
  try {
    const { from, to } = req.params;

    const rate = await multiCurrencySystem.getExchangeRate(from as any, to as any);

    res.json({
      success: true,
      exchange_rate: rate
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Invalid currency pair or rate not available'
    });
  }
});

// Convert currency
app.post('/api/convert-currency', async (req, res) => {
  try {
    const { from_currency, to_currency, amount, user_id } = req.body;

    const conversion = await multiCurrencySystem.convertCurrency(
      from_currency,
      to_currency,
      amount,
      user_id
    );

    res.json({
      success: true,
      conversion
    });

  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Currency conversion failed'
    });
  }
});

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  secureLogger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method
  });

  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('🌊 Universal Payment Protocol Server');
  console.log('🚀 Payment processing with Visa Direct integration');
  console.log(`📡 Server running on http://0.0.0.0:${PORT}`);
  console.log(`🔒 Security: Enhanced with native payment processing`);
  console.log(`💳 Payment Gateway: UPP Native (Visa Direct)`);
  console.log(`🌍 Multi-currency: ${multiCurrencySystem ? 'Enabled' : 'Disabled'}`);
  console.log(`📊 Audit Trail: ${auditTrail ? 'Enabled' : 'Disabled'}`);
  console.log('✅ Application ready! Click the webview button to access.');
});

// Handle server startup errors
server.on('error', (error: any) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Trying port ${PORT + 1}...`);
    app.listen(PORT + 1, '0.0.0.0');
  } else {
    console.error('❌ Server startup error:', error);
  }
});

export default app;