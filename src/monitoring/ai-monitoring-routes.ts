import { Router, Request, Response } from 'express';
import { aiErrorHandler } from './ai-error-handler';
import secureLogger from '../shared/logger.js';
import { asyncHandler } from '../utils/errors';

const router = Router();

// Get AI error handler statistics
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  console.log('📥 AI monitoring stats requested');
  
  const stats = aiErrorHandler.getStats();
  
  res.json({
    success: true,
    data: {
      ...stats,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      features: {
        openai: !!process.env.OPENAI_API_KEY,
        anthropic: !!process.env.ANTHROPIC_API_KEY,
        github: !!process.env.GITHUB_TOKEN
      }
    }
  });
}));

// Manually trigger error analysis (for testing)
router.post('/analyze', asyncHandler(async (req: Request, res: Response) => {
  console.log('📥 Manual error analysis requested');
  
  const { error, context } = req.body;
  
  if (!error) {
    res.status(400).json({
      success: false,
      error: 'Error message is required'
    });
    return;
  }

  try {
    await aiErrorHandler.captureError(error, context);
    
    res.json({
      success: true,
      message: 'Error captured for AI analysis',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    secureLogger.error('Manual error analysis failed', { error: String(err), originalError: error });
    res.status(500).json({
      success: false,
      error: 'Failed to capture error for analysis'
    });
  }
}));

// Test AI analysis with a sample error
router.post('/test', asyncHandler(async (req: Request, res: Response) => {
  console.log('📥 AI analysis test requested');
  
  const testError = new Error('Test error for AI analysis');
  const testContext = {
    endpoint: '/api/monitoring/test',
    method: 'POST',
    userAgent: 'AI-Test-Agent',
    ip: '127.0.0.1',
    requestBody: { test: true }
  };

  try {
    await aiErrorHandler.captureError(testError, testContext);
    
    res.json({
      success: true,
      message: 'Test error captured for AI analysis',
      error: testError.message,
      context: testContext,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    secureLogger.error('AI analysis test failed', { error: String(err) });
    res.status(500).json({
      success: false,
      error: 'Failed to capture test error'
    });
  }
}));

// Get configuration status
router.get('/config', asyncHandler(async (req: Request, res: Response) => {
  console.log('📥 AI monitoring config requested');
  
  const config = {
    openai: {
      configured: !!process.env.OPENAI_API_KEY,
      model: 'gpt-4'
    },
    anthropic: {
      configured: !!process.env.ANTHROPIC_API_KEY,
      model: 'claude-3-sonnet-20240229'
    },
    github: {
      configured: !!process.env.GITHUB_TOKEN,
      owner: process.env.GITHUB_OWNER || 'robertsn808',
      repo: process.env.GITHUB_REPO || 'UniversalPaymentProtocol'
    },
    thresholds: {
      slowResponse: 5000, // 5 seconds
      verySlowResponse: 10000, // 10 seconds
      slowQuery: 1000, // 1 second
      highMemory: 500 // 500MB
    }
  };
  
  res.json({
    success: true,
    data: config,
    timestamp: new Date().toISOString()
  });
}));

// Health check for AI monitoring system
router.get('/health', asyncHandler(async (req: Request, res: Response) => {
  console.log('📥 AI monitoring health check requested');
  
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      openai: !!process.env.OPENAI_API_KEY,
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      github: !!process.env.GITHUB_TOKEN
    },
    stats: aiErrorHandler.getStats()
  };
  
  res.json({
    success: true,
    data: health
  });
}));

export default router;
