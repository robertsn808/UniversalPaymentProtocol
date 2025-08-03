// Universal Payment Protocol - Secure Payment Routes
// PCI DSS Level 1 Compliant Payment Processing

import express from 'express';
import rateLimit from 'express-rate-limit';
import { body, param, query, validationResult } from 'express-validator';
import { PaymentService } from '../services/payments/PaymentService';
import { AuditLogger } from '../services/payments/logging';
import { FraudDetectionService } from '../services/security/FraudDetectionService';
import { AuthenticationMiddleware } from '../middleware/auth';
import { SecurityMiddleware } from '../middleware/security';
import { PaymentRequest, PaymentResult, RefundRequest } from '../types/payments';

const router = express.Router();
const paymentService = new PaymentService();
const auditLogger = new AuditLogger();
const fraudDetection = new FraudDetectionService();

// Rate limiting for payment endpoints
const paymentRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // Limit each IP to 20 payment requests per minute
  message: {
    error: 'Too many payment attempts. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use IP + user ID for authenticated requests
    const userId = req.user?.id || 'anonymous';
    return `${req.ip}-${userId}`;
  }
});

// Card testing protection
const cardTestingProtection = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each card to 5 attempts per hour
  keyGenerator: (req) => {
    // Use masked card number for tracking
    const cardLast4 = req.body.payment_method?.card?.last4 || 'unknown';
    return `card-${cardLast4}-${req.ip}`;
  },
  message: {
    error: 'Card testing detected. Please contact support.',
    code: 'CARD_TESTING_BLOCKED'
  }
});

// Input validation schemas
const createPaymentValidation = [
  body('amount')
    .isFloat({ min: 0.01, max: 999999.99 })
    .withMessage('Amount must be between $0.01 and $999,999.99'),
  
  body('currency')
    .isLength({ min: 3, max: 3 })
    .isAlpha()
    .toUpperCase()
    .withMessage('Currency must be a valid 3-letter ISO code'),
  
  body('description')
    .isLength({ min: 1, max: 255 })
    .trim()
    .escape()
    .withMessage('Description is required and must be under 255 characters'),
  
  body('merchant_id')
    .isAlphanumeric('en-US', { ignore: '_-' })
    .isLength({ min: 1, max: 50 })
    .withMessage('Invalid merchant ID format'),
  
  body('device_type')
    .isIn(['smartphone', 'smart_tv', 'iot_device', 'voice_assistant', 'gaming_console', 'web'])
    .withMessage('Invalid device type'),
  
  body('device_id')
    .isLength({ min: 1, max: 100 })
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Invalid device ID format'),
  
  body('customer_email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Invalid email format'),
  
  body('payment_method')
    .optional()
    .isObject()
    .withMessage('Payment method must be an object'),
  
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object')
];

// Security middleware
router.use(SecurityMiddleware.helmet());
router.use(SecurityMiddleware.cors());
router.use(SecurityMiddleware.requestSanitization());
router.use(AuthenticationMiddleware.requireAuthentication());

/**
 * @route   POST /api/payments
 * @desc    Create a new payment
 * @access  Authenticated
 * @security PCI DSS compliant payment processing
 */
router.post('/',
  paymentRateLimit,
  cardTestingProtection,
  createPaymentValidation,
  async (req: express.Request, res: express.Response) => {
    const requestId = req.headers['x-request-id'] as string || generateRequestId();
    const startTime = Date.now();

    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        await auditLogger.logSecurityEvent({
          event_type: 'PAYMENT_VALIDATION_FAILED',
          user_id: req.user.id,
          ip_address: req.ip,
          user_agent: req.get('User-Agent'),
          request_id: requestId,
          errors: errors.array(),
          severity: 'medium'
        });

        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array(),
          request_id: requestId
        });
      }

      // Extract and sanitize payment data
      const paymentData: PaymentRequest = {
        amount: req.body.amount,
        currency: req.body.currency,
        description: req.body.description,
        merchant_id: req.body.merchant_id,
        device_type: req.body.device_type,
        device_id: req.body.device_id,
        customer_email: req.body.customer_email,
        payment_method: req.body.payment_method,
        metadata: {
          ...req.body.metadata,
          ip_address: hashIP(req.ip), // Hash IP for privacy
          user_agent_hash: hashUserAgent(req.get('User-Agent')),
          request_id: requestId,
          timestamp: new Date().toISOString()
        }
      };

      // Process payment with fraud detection
      const result: PaymentResult = await paymentService.processPayment(paymentData, {
        user_id: req.user.id,
        request_id: requestId,
        idempotency_key: req.headers['idempotency-key'] as string
      });

      // Return success response (PCI compliant - no sensitive data)
      res.status(201).json({
        success: true,
        payment_id: result.transaction_id,
        amount: result.amount,
        currency: result.currency,
        status: result.status,
        device_type: paymentData.device_type,
        created_at: new Date().toISOString(),
        request_id: requestId
      });

    } catch (error: any) {
      await auditLogger.logError({
        event_type: 'PAYMENT_PROCESSING_ERROR',
        user_id: req.user?.id,
        error_message: error.message,
        request_id: requestId,
        ip_address: req.ip,
        severity: 'high'
      });

      res.status(500).json({
        success: false,
        error: 'Payment processing failed',
        message: 'An error occurred while processing your payment. Please try again.',
        request_id: requestId
      });
    }
  }
);

// Utility functions
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2)}`;
}

function hashIP(ip: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(ip + process.env.IP_HASH_SALT).digest('hex').substring(0, 16);
}

function hashUserAgent(userAgent: string | undefined): string {
  if (!userAgent) return 'unknown';
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(userAgent + process.env.UA_HASH_SALT).digest('hex').substring(0, 16);
}

export default router;