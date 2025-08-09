// Card Payment Routes - PCI DSS Compliant API Endpoints
// Secure payment processing with proper authentication and validation

import { Router, Request, Response } from 'express';
import { CardPaymentProcessor } from './card-processor.js';
import { CardSecurityManager } from './card-security.js';
import { CardValidator } from './card-validator.js';
import { CardProcessingConfig, CardPaymentRequest } from './card-payment-types.js';
import { authenticateToken, AuthenticatedRequest } from '../../auth/jwt.js';
import { asyncHandler } from '../../utils/errors.js';
import { validateInput } from '../../utils/validation.js';
import { paymentRateLimit } from '../../middleware/security.js';
import secureLogger from '../../shared/logger.js';

const router = Router();

// Initialize card payment processor
let cardProcessor: CardPaymentProcessor;
let securityManager: CardSecurityManager;

try {
  const config: CardProcessingConfig = {
    gateway: {
      provider: 'stripe',
      api_key: process.env.STRIPE_SECRET_KEY || '',
      webhook_secret: process.env.STRIPE_WEBHOOK_SECRET,
      environment: (process.env.NODE_ENV === 'production' ? 'live' : 'test') as 'test' | 'live'
    },
    security: {
      encryption_key: process.env.CARD_ENCRYPTION_KEY || 'default-encryption-key-32-chars-long',
      pci_compliance: true,
      tokenization_enabled: true,
      cvv_required: true,
      avs_required: true
    },
    processing: {
      auto_capture: true,
      currency_default: 'USD',
      supported_currencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'],
      max_amount: 1000000,
      min_amount: 0.01
    },
    fraud_detection: {
      enabled: true,
      risk_threshold: 50,
      avs_strict: true,
      cvv_strict: true
    }
  };

  cardProcessor = new CardPaymentProcessor(config);
  securityManager = new CardSecurityManager(config);
  
  secureLogger.info('💳 Card payment routes initialized with PCI compliance');
} catch (error) {
  secureLogger.error('💥 Card payment initialization failed', { 
    error: error instanceof Error ? error.message : 'Unknown error' 
  });
}

/**
 * POST /api/card/process
 * Process a card payment with full validation and security
 */
router.post('/process', 
  paymentRateLimit,
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!cardProcessor) {
      return res.status(503).json({
        success: false,
        error: 'Card payment service unavailable'
      });
    }

    try {
      // Validate request body
      const validation = validateInput(req.body, {
        amount: 'required|numeric|min:0.01',
        currency: 'required|string|length:3',
        description: 'required|string|max:255',
        merchant_id: 'required|string|length:8,20',
        card_data: 'required|object',
        'card_data.card_number': 'required|string',
        'card_data.expiry_month': 'required|numeric|min:1|max:12',
        'card_data.expiry_year': 'required|numeric|min:2024|max:2034',
        'card_data.cvv': 'string|length:3,4'
      });

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: validation.errors
        });
      }

      // Create payment request
      const paymentRequest: CardPaymentRequest = {
        amount: parseFloat(req.body.amount),
        currency: req.body.currency.toUpperCase(),
        description: req.body.description,
        merchant_id: req.body.merchant_id,
        card_data: {
          card_number: req.body.card_data.card_number,
          encrypted_full_number: req.body.card_data.encrypted_full_number || '',
          expiry_month: parseInt(req.body.card_data.expiry_month),
          expiry_year: parseInt(req.body.card_data.expiry_year),
          cvv: req.body.card_data.cvv,
          card_type: req.body.card_data.card_type,
          card_brand: req.body.card_data.card_brand,
          billing_address: req.body.card_data.billing_address,
          encryption_version: req.body.card_data.encryption_version || '1.0',
          encrypted_at: req.body.card_data.encrypted_at || new Date().toISOString()
        },
        customer: req.body.customer,
        metadata: req.body.metadata,
        location: req.body.location,
        device_info: req.body.device_info,
        security_context: req.body.security_context
      };

      // Add request metadata
      paymentRequest.metadata = {
        ...paymentRequest.metadata,
        user_id: req.user?.id,
        ip_address: req.ip,
        user_agent: req.get('User-Agent'),
        request_id: req.headers['x-correlation-id'] as string
      };

      // Process payment
      const result = await cardProcessor.processCardPayment(paymentRequest);

      // Log successful transaction (without sensitive data)
      const auditLog = securityManager.generateAuditLog(
        'card_payment_processed',
        req.user?.id || 'anonymous',
        { ip_address: req.ip, user_agent: req.get('User-Agent') }
      );

      secureLogger.info('💳 Card payment processed', {
        transaction_id: result.transaction_id,
        amount: result.amount,
        currency: result.currency,
        status: result.status,
        user_id: req.user?.id,
        audit_log: auditLog
      });

      // Return sanitized result
      const sanitizedResult = securityManager.sanitizeForLogging(result);
      
      return res.status(result.success ? 200 : 400).json({
        success: result.success,
        data: sanitizedResult,
        message: result.success ? 'Payment processed successfully' : result.error_message
      });

    } catch (error: any) {
      secureLogger.error('💥 Card payment route error', {
        error: error.message,
        user_id: req.user?.id,
        ip_address: req.ip
      });

      return res.status(500).json({
        success: false,
        error: 'Payment processing failed',
        message: 'An error occurred while processing your payment'
      });
    }
  })
);

/**
 * POST /api/card/token/process
 * Process payment using saved card token
 */
router.post('/token/process',
  paymentRateLimit,
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!cardProcessor) {
      return res.status(503).json({
        success: false,
        error: 'Card payment service unavailable'
      });
    }

    try {
      // Validate request
      const validation = validateInput(req.body, {
        token_id: 'required|string',
        amount: 'required|numeric|min:0.01',
        currency: 'required|string|length:3',
        description: 'required|string|max:255'
      });

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: validation.errors
        });
      }

      // Process token payment
      const result = await cardProcessor.processTokenPayment(
        req.body.token_id,
        parseFloat(req.body.amount),
        req.body.currency.toUpperCase(),
        req.body.description
      );

      // Log transaction
      const auditLog = securityManager.generateAuditLog(
        'token_payment_processed',
        req.user?.id || 'anonymous',
        { ip_address: req.ip, token_id: req.body.token_id }
      );

      secureLogger.info('🎫 Token payment processed', {
        transaction_id: result.transaction_id,
        token_id: req.body.token_id,
        amount: result.amount,
        status: result.status,
        user_id: req.user?.id,
        audit_log: auditLog
      });

      const sanitizedResult = securityManager.sanitizeForLogging(result);

      return res.status(result.success ? 200 : 400).json({
        success: result.success,
        data: sanitizedResult,
        message: result.success ? 'Token payment processed successfully' : result.error_message
      });

    } catch (error: any) {
      secureLogger.error('💥 Token payment route error', {
        error: error.message,
        user_id: req.user?.id,
        token_id: req.body.token_id
      });

      return res.status(500).json({
        success: false,
        error: 'Token payment processing failed'
      });
    }
  })
);

/**
 * POST /api/card/refund
 * Refund a card payment
 */
router.post('/refund',
  paymentRateLimit,
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!cardProcessor) {
      return res.status(503).json({
        success: false,
        error: 'Card payment service unavailable'
      });
    }

    try {
      // Validate request
      const validation = validateInput(req.body, {
        payment_intent_id: 'required|string',
        amount: 'numeric|min:0.01',
        reason: 'string|max:255'
      });

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: validation.errors
        });
      }

      // Process refund
      const result = await cardProcessor.refundPayment(
        req.body.payment_intent_id,
        req.body.amount ? parseFloat(req.body.amount) : undefined,
        req.body.reason
      );

      // Log refund
      const auditLog = securityManager.generateAuditLog(
        'payment_refunded',
        req.user?.id || 'anonymous',
        { 
          ip_address: req.ip, 
          payment_intent_id: req.body.payment_intent_id,
          refund_amount: req.body.amount
        }
      );

      secureLogger.info('💰 Payment refunded', {
        transaction_id: result.transaction_id,
        payment_intent_id: req.body.payment_intent_id,
        amount: result.amount,
        status: result.status,
        user_id: req.user?.id,
        audit_log: auditLog
      });

      const sanitizedResult = securityManager.sanitizeForLogging(result);

      return res.status(result.success ? 200 : 400).json({
        success: result.success,
        data: sanitizedResult,
        message: result.success ? 'Refund processed successfully' : result.error_message
      });

    } catch (error: any) {
      secureLogger.error('💥 Refund route error', {
        error: error.message,
        user_id: req.user?.id,
        payment_intent_id: req.body.payment_intent_id
      });

      return res.status(500).json({
        success: false,
        error: 'Refund processing failed'
      });
    }
  })
);

/**
 * GET /api/card/status/:transactionId
 * Get payment status
 */
router.get('/status/:transactionId',
  paymentRateLimit,
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!cardProcessor) {
      return res.status(503).json({
        success: false,
        error: 'Card payment service unavailable'
      });
    }

    try {
      const { transactionId } = req.params;

      // Validate transaction ID
      if (!transactionId || transactionId.length < 10) {
        return res.status(400).json({
          success: false,
          error: 'Invalid transaction ID'
        });
      }

      // Get payment status from Stripe (in production, this would be from your database)
      // For now, we'll return a mock response
      const status = {
        transaction_id: transactionId,
        status: 'completed',
        amount: 0,
        currency: 'USD',
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString()
      };

      // Log status check
      const auditLog = securityManager.generateAuditLog(
        'payment_status_checked',
        req.user?.id || 'anonymous',
        { ip_address: req.ip, transaction_id: transactionId }
      );

      secureLogger.info('📊 Payment status checked', {
        transaction_id: transactionId,
        user_id: req.user?.id,
        audit_log: auditLog
      });

      return res.json({
        success: true,
        data: status
      });

    } catch (error: any) {
      secureLogger.error('💥 Payment status check error', {
        error: error.message,
        user_id: req.user?.id,
        transaction_id: req.params.transactionId
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve payment status'
      });
    }
  })
);

/**
 * GET /api/card/compliance
 * Get PCI compliance status
 */
router.get('/compliance',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!securityManager) {
      return res.status(503).json({
        success: false,
        error: 'Security service unavailable'
      });
    }

    try {
      const compliance = securityManager.validatePCICompliance();

      return res.json({
        success: true,
        data: {
          pci_compliant: compliance.compliant,
          issues: compliance.issues,
          checked_at: new Date().toISOString(),
          environment: process.env.NODE_ENV || 'development'
        }
      });

    } catch (error: any) {
      secureLogger.error('💥 Compliance check error', {
        error: error.message,
        user_id: req.user?.id
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to check compliance status'
      });
    }
  })
);

/**
 * POST /api/card/validate
 * Validate card data without processing payment
 */
router.post('/validate',
  paymentRateLimit,
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Validate request
      const validation = validateInput(req.body, {
        card_data: 'required|object',
        'card_data.card_number': 'required|string',
        'card_data.expiry_month': 'required|numeric|min:1|max:12',
        'card_data.expiry_year': 'required|numeric|min:2024|max:2034',
        'card_data.cvv': 'string|length:3,4'
      });

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: validation.errors
        });
      }

      // Validate card data
      const cardData = {
        card_number: req.body.card_data.card_number,
        encrypted_full_number: req.body.card_data.encrypted_full_number || '',
        expiry_month: parseInt(req.body.card_data.expiry_month),
        expiry_year: parseInt(req.body.card_data.expiry_year),
        cvv: req.body.card_data.cvv,
        card_type: req.body.card_data.card_type,
        card_brand: req.body.card_data.card_brand,
        billing_address: req.body.card_data.billing_address,
        encryption_version: req.body.card_data.encryption_version || '1.0',
        encrypted_at: req.body.card_data.encrypted_at || new Date().toISOString()
      };

      const validationResult = CardValidator.validateCardData(cardData);

      // Log validation attempt (without sensitive data)
      const auditLog = securityManager.generateAuditLog(
        'card_validation_attempted',
        req.user?.id || 'anonymous',
        { ip_address: req.ip, validation_success: validationResult.valid }
      );

      secureLogger.info('🔍 Card validation attempted', {
        user_id: req.user?.id,
        validation_success: validationResult.valid,
        error_count: validationResult.errors.length,
        warning_count: validationResult.warnings.length,
        audit_log: auditLog
      });

      return res.json({
        success: true,
        data: {
          valid: validationResult.valid,
          errors: validationResult.errors,
          warnings: validationResult.warnings,
          card_info: validationResult.card_info
        }
      });

    } catch (error: any) {
      secureLogger.error('💥 Card validation error', {
        error: error.message,
        user_id: req.user?.id
      });

      return res.status(500).json({
        success: false,
        error: 'Card validation failed'
      });
    }
  })
);

export default router;
