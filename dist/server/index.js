import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { UPPStripeProcessor } from './stripe-integration.js';
import { DeviceAdapterFactory } from '../src/modules/universal-payment-protocol/devices/DeviceAdapterFactory.js';
import { SecurityManagerAdapter } from './SecurityManagerAdapter.js';
import { CurrencyManager } from '../src/modules/universal-payment-protocol/currency/CurrencyManager.js';
// Load environment variables
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
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
let stripeProcessor;
let securityManager;
let currencyManager;
try {
    stripeProcessor = new UPPStripeProcessor();
    securityManager = new SecurityManagerAdapter();
    currencyManager = new CurrencyManager();
    console.log('✅ Core UPP services initialized successfully');
}
catch (error) {
    console.error('❌ Failed to initialize core services:', error);
    process.exit(1);
}
// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    message: {
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});
// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));
app.use(cors({
    origin: process.env.CORS_ORIGIN || process.env.FRONTEND_URL || false,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-ID', 'X-Device-Type']
}));
app.use(limiter);
app.use(express.json({
    limit: '1mb',
    verify: (req, res, buf) => {
        try {
            JSON.parse(buf.toString());
        }
        catch (e) {
            throw new Error('Invalid JSON payload');
        }
    }
}));
// Request logging middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    const method = req.method;
    const url = req.url;
    const ip = req.ip || req.connection.remoteAddress;
    console.log(`[${timestamp}] ${method} ${url} - IP: ${ip}`);
    next();
});
// Error handling middleware
const errorHandler = (err, req, res, next) => {
    console.error('❌ Server Error:', err);
    if (err instanceof z.ZodError) {
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
app.get('/', (req, res) => {
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
app.get('/health', (req, res) => {
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
// Process payment endpoint
app.post('/api/v1/payments/process', async (req, res, next) => {
    try {
        // Validate input
        const validatedData = PaymentRequestSchema.parse(req.body);
        // Security checks
        const deviceId = req.headers['x-device-id'] || validatedData.deviceId;
        const ipAddress = req.ip || req.connection.remoteAddress;
        // Fraud detection
        const fraudResult = await securityManager.detectFraud(validatedData.amount, deviceId, { ipAddress, userAgent: req.headers['user-agent'] });
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
            const conversionResult = await currencyManager.convertCurrency(validatedData.amount, validatedData.currency, 'USD');
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
    }
    catch (error) {
        next(error);
    }
});
// Device registration endpoint
app.post('/api/v1/devices/register', async (req, res, next) => {
    try {
        // Validate input
        const validatedData = DeviceRegistrationSchema.parse(req.body);
        // Security validation
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'] || validatedData.userAgent;
        // Device attestation
        const attestationResult = await securityManager.attestDevice(validatedData.fingerprint, { deviceType: validatedData.deviceType, capabilities: validatedData.capabilities, ipAddress, userAgent });
        if (!attestationResult.known_device && attestationResult.trust_score < 50) {
            return res.status(403).json({
                success: false,
                error: 'Device attestation failed',
                message: 'Device could not be verified as legitimate'
            });
        }
        // Generate secure device ID
        const deviceId = `${validatedData.deviceType}_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
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
    }
    catch (error) {
        next(error);
    }
});
// Device capabilities endpoint
app.get('/api/v1/devices/:deviceType/capabilities', (req, res) => {
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
app.get('/api/v1/currencies/supported', (req, res) => {
    res.json({
        success: true,
        currencies: currencyManager.getSupportedCurrencies(),
        baseCurrency: 'USD',
        lastUpdated: new Date().toISOString()
    });
});
// Metrics endpoint for monitoring
app.get('/metrics', (req, res) => {
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
app.use('*', (req, res) => {
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
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});
export default app;
