// Stripe MCP AI Routes for Universal Payment Protocol
// Exposes AI-powered payment analytics and insights via REST API

import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { stripeAI } from '../modules/stripe-mcp/StripeAIManager.js';
import { validateInput } from '../utils/validation.js';
import { SecureErrorHandler } from '../utils/error-handling.js';

const router = express.Router();

// Rate limiting for AI endpoints (more restrictive due to computational cost)
const aiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 AI requests per windowMs
  message: { error: 'Too many AI requests, try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limiting to all AI routes
router.use(aiRateLimit);

// Validation schemas
const PaymentAnalysisSchema = z.object({
  transactionId: z.string().min(1, 'Transaction ID is required')
});

const CustomerAnalysisSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required')
});

const FraudDetectionSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().min(3).max(3).default('USD'),
  deviceType: z.string().optional(),
  deviceId: z.string().optional(),
  customerEmail: z.string().email().optional(),
  metadata: z.record(z.string(), z.any()).optional()
});

const RevenueInsightsSchema = z.object({
  timeRange: z.enum(['7d', '30d', '90d']).default('30d')
});

// GET /api/ai/capabilities - Get available AI capabilities
router.get('/capabilities', async (req, res) => {
  try {
    const capabilities = stripeAI.getCapabilities();
    const healthStatus = await stripeAI.healthCheck();
    
    res.json({
      success: true,
      data: {
        capabilities,
        health: healthStatus,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    const errorResponse = SecureErrorHandler.handleError(error, {
      operation: 'ai_capabilities_check',
      additionalContext: { endpoint: '/api/ai/capabilities' }
    });
    
    res.status(500).json({
      success: false,
      error: errorResponse.error.message,
      correlationId: errorResponse.error.correlationId
    });
  }
});

// POST /api/ai/analyze/payment - Analyze a specific payment transaction
router.post('/analyze/payment', async (req, res) => {
  try {
    const validation = validateInput(PaymentAnalysisSchema, req.body);
    if (!validation.success) {
      const errorResult = validation as { success: false; errors: string[] };
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errorResult.errors
      });
    }

    const { transactionId } = validation.data;
    const insight = await stripeAI.analyzePayment(transactionId);
    
    if (!insight) {
      return res.status(404).json({
        success: false,
        error: 'Payment analysis not available'
      });
    }

    res.json({
      success: true,
      data: insight,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    const errorResponse = SecureErrorHandler.handleError(error, {
      operation: 'ai_payment_analysis',
      additionalContext: { 
        transactionId: req.body.transactionId?.substring(0, 10),
        endpoint: '/api/ai/analyze/payment'
      }
    });
    
    res.status(500).json({
      success: false,
      error: errorResponse.error.message,
      correlationId: errorResponse.error.correlationId
    });
  }
});

// POST /api/ai/analyze/customer - Get comprehensive customer intelligence
router.post('/analyze/customer', async (req, res) => {
  try {
    const validation = validateInput(CustomerAnalysisSchema, req.body);
    if (!validation.success) {
      const errorResult = validation as { success: false; errors: string[] };
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errorResult.errors
      });
    }

    const { customerId } = validation.data;
    const intelligence = await stripeAI.getCustomerIntelligence(customerId);
    
    if (!intelligence) {
      return res.status(404).json({
        success: false,
        error: 'Customer intelligence not available'
      });
    }

    res.json({
      success: true,
      data: intelligence,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    const errorResponse = SecureErrorHandler.handleError(error, {
      operation: 'ai_customer_analysis',
      additionalContext: { 
        customerId: req.body.customerId?.substring(0, 10),
        endpoint: '/api/ai/analyze/customer'
      }
    });
    
    res.status(500).json({
      success: false,
      error: errorResponse.error.message,
      correlationId: errorResponse.error.correlationId
    });
  }
});

// POST /api/ai/detect/fraud - AI-powered fraud detection
router.post('/detect/fraud', async (req, res) => {
  try {
    const validation = validateInput(FraudDetectionSchema, req.body);
    if (!validation.success) {
      const errorResult = validation as { success: false; errors: string[] };
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errorResult.errors
      });
    }

    const fraudAnalysis = await stripeAI.detectFraud(validation.data);
    
    res.json({
      success: true,
      data: {
        ...fraudAnalysis,
        timestamp: new Date().toISOString(),
        recommendation: fraudAnalysis.riskLevel === 'high' 
          ? 'Review transaction manually before processing'
          : fraudAnalysis.riskLevel === 'medium'
          ? 'Apply additional verification steps'
          : 'Process transaction normally'
      }
    });
  } catch (error: any) {
    const errorResponse = SecureErrorHandler.handleError(error, {
      operation: 'ai_fraud_detection',
      additionalContext: { 
        hasAmount: !!req.body.amount,
        endpoint: '/api/ai/detect/fraud'
      }
    });
    
    res.status(500).json({
      success: false,
      error: errorResponse.error.message,
      correlationId: errorResponse.error.correlationId
    });
  }
});

// POST /api/ai/insights/revenue - Generate revenue insights and forecasting  
router.post('/insights/revenue', async (req, res) => {
  try {
    const validation = validateInput(RevenueInsightsSchema, req.body);
    if (!validation.success) {
      const errorResult = validation as { success: false; errors: string[] };
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errorResult.errors
      });
    }

    const { timeRange } = validation.data;
    const insights = await stripeAI.getRevenueInsights(timeRange);
    
    if (!insights) {
      return res.status(500).json({
        success: false,
        error: 'Revenue insights not available'
      });
    }

    res.json({
      success: true,
      data: {
        ...insights,
        generatedAt: new Date().toISOString(),
        disclaimer: 'AI-generated insights for informational purposes'
      }
    });
  } catch (error: any) {
    const errorResponse = SecureErrorHandler.handleError(error, {
      operation: 'ai_revenue_insights',
      additionalContext: { 
        timeRange: req.body.timeRange,
        endpoint: '/api/ai/insights/revenue'
      }
    });
    
    res.status(500).json({
      success: false,
      error: errorResponse.error.message,
      correlationId: errorResponse.error.correlationId
    });
  }
});

// GET /api/ai/health - Health check for AI services
router.get('/health', async (req, res) => {
  try {
    const healthStatus = await stripeAI.healthCheck();
    
    res.json({
      success: true,
      data: {
        service: 'Stripe AI Manager',
        status: healthStatus.healthy ? 'healthy' : 'unhealthy',
        ...healthStatus,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    const errorResponse = SecureErrorHandler.handleError(error, {
      operation: 'ai_health_check',
      additionalContext: { endpoint: '/api/ai/health' }
    });
    
    res.status(500).json({
      success: false,
      error: errorResponse.error.message,
      correlationId: errorResponse.error.correlationId
    });
  }
});

export default router;