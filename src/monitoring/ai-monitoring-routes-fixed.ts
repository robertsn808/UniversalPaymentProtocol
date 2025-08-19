import { Router, Request, Response } from 'express';
import { aiErrorHandler } from './ai-error-handler.js';
import secureLogger from '../shared/logger.js';
import { asyncHandler } from '../utils/errors.js';
import * as path from 'path';
import * as fs from 'fs';

const router = Router();

// Serve the AI monitoring dashboard (best-effort)
router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  try {
    const dashboardPath = path.join(__dirname, 'AIMonitoringDashboard.html');
    const html = fs.readFileSync(dashboardPath, 'utf8');
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    secureLogger.error('Failed to serve AI monitoring dashboard', { error: String(error) });
    res.status(200).json({
      success: true,
      message: 'AI Monitoring dashboard not available in this build',
    });
  }
}));

// Get AI error handler statistics
router.get('/stats', asyncHandler(async (_req: Request, res: Response) => {
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
  const { error, context } = req.body;
  if (!error) {
    res.status(400).json({ success: false, error: 'Error message is required' });
    return;
  }
  await aiErrorHandler.captureError(error, context);
  res.json({ success: true, message: 'Error captured for AI analysis' });
}));

// Health check for AI monitoring system
router.get('/health', asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: { status: 'healthy', timestamp: new Date().toISOString(), stats: aiErrorHandler.getStats() } });
}));

export default router;

