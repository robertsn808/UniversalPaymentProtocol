import { Request, Response, NextFunction } from 'express';

import { healthCheckService } from '../monitoring/HealthCheck';
import { metricsCollector } from '../monitoring/MetricsCollector';

// Performance monitoring middleware
export const performanceMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  
  // Track requests
  healthCheckService.incrementRequests();
  
  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function(this: Response, ...args: any[]): Response {
    const responseTime = Date.now() - startTime;
    const isError = res.statusCode >= 400;
    
    // Record metrics
    metricsCollector.recordRequest(responseTime, isError);
    healthCheckService.recordResponseTime(responseTime);
    
    // Track payments specifically
    if (req.path === '/api/process-payment' && res.statusCode < 400) {
      healthCheckService.incrementPayments();
    }
    
    // Call original end method
    return originalEnd.apply(this, args as Parameters<typeof originalEnd>);
  };
  
  next();
};

// Request correlation ID middleware for tracing
export const correlationIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const correlationId = req.headers['x-correlation-id'] as string || 
                       `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  req.headers['x-correlation-id'] = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  
  next();
};

// Response time header middleware
export const responseTimeMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    res.setHeader('X-Response-Time', `${responseTime}ms`);
  });
  
  next();
};