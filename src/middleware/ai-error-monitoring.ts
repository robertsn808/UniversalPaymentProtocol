import { Request, Response, NextFunction } from 'express';
import { aiErrorHandler } from '../monitoring/ai-error-handler';
import secureLogger from '../shared/logger.js';

export interface AIErrorContext {
  endpoint?: string;
  method?: string;
  userAgent?: string;
  ip?: string;
  requestBody?: any;
  userId?: string;
  sessionId?: string;
  correlationId?: string;
}

export function aiErrorMonitoring() {
  return async (error: Error, req: Request, res: Response, next: NextFunction) => {
    try {
      // Extract context from request
      const context: AIErrorContext = {
        endpoint: req.path,
        method: req.method,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress,
        requestBody: req.body,
        userId: (req as any).user?.userId,
        sessionId: (req as any).sessionId,
        correlationId: (req as any).correlationId
      };

      // Capture error for AI analysis
      await aiErrorHandler.captureError(error, context);

      // Log the error with context
      secureLogger.error('Error captured by AI monitoring', {
        error: error.message,
        stack: error.stack,
        context,
        url: req.url,
        method: req.method
      });

    } catch (monitoringError) {
      // Don't let monitoring errors affect the main error handling
      secureLogger.error('AI error monitoring failed', { 
        originalError: error.message,
        monitoringError 
      });
    }

    // Continue with normal error handling
    next(error);
  };
}

export function aiRequestMonitoring() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const originalSend = res.send;

    // Override res.send to capture response data
    res.send = function(body: any) {
      const responseTime = Date.now() - startTime;
      
      // Monitor for potential issues
      if (responseTime > 5000) { // 5 seconds threshold
        aiErrorHandler.captureError(
          `Slow response detected: ${responseTime}ms for ${req.method} ${req.path}`,
          {
            endpoint: req.path,
            method: req.method,
            responseTime,
            statusCode: res.statusCode,
            userAgent: req.get('User-Agent'),
            ip: req.ip || req.connection.remoteAddress
          }
        );
      }

      if (res.statusCode >= 500) {
        aiErrorHandler.captureError(
          `Server error ${res.statusCode} on ${req.method} ${req.path}`,
          {
            endpoint: req.path,
            method: req.method,
            statusCode: res.statusCode,
            responseBody: body,
            userAgent: req.get('User-Agent'),
            ip: req.ip || req.connection.remoteAddress
          }
        );
      }

      return originalSend.call(this, body);
    };

    next();
  };
}

export function aiPerformanceMonitoring() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = process.hrtime.bigint();

    res.on('finish', () => {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

      // Monitor memory usage
      const memUsage = process.memoryUsage();
      const memUsageMB = {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024)
      };

      // Alert on high memory usage
      if (memUsageMB.heapUsed > 500) { // 500MB threshold
        aiErrorHandler.captureError(
          `High memory usage detected: ${memUsageMB.heapUsed}MB`,
          {
            endpoint: req.path,
            method: req.method,
            memoryUsage: memUsageMB,
            responseTime: duration,
            statusCode: res.statusCode
          }
        );
      }

      // Alert on very slow responses
      if (duration > 10000) { // 10 seconds threshold
        aiErrorHandler.captureError(
          `Very slow response: ${duration.toFixed(2)}ms for ${req.method} ${req.path}`,
          {
            endpoint: req.path,
            method: req.method,
            responseTime: duration,
            memoryUsage: memUsageMB,
            statusCode: res.statusCode
          }
        );
      }
    });

    next();
  };
}

export function aiDatabaseMonitoring() {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalQuery = (req as any).db?.query;
    
    if (originalQuery) {
      (req as any).db.query = function(...args: any[]) {
        const startTime = Date.now();
        
        return originalQuery.apply(this, args).then((result: any) => {
          const queryTime = Date.now() - startTime;
          
          // Monitor slow database queries
          if (queryTime > 1000) { // 1 second threshold
            aiErrorHandler.captureError(
              `Slow database query: ${queryTime}ms`,
              {
                endpoint: req.path,
                method: req.method,
                queryTime,
                query: args[0]?.substring(0, 100) + '...',
                userAgent: req.get('User-Agent'),
                ip: req.ip || req.connection.remoteAddress
              }
            );
          }
          
          return result;
        }).catch((error: Error) => {
          // Capture database errors
          aiErrorHandler.captureError(error, {
            endpoint: req.path,
            method: req.method,
            query: args[0]?.substring(0, 100) + '...',
            userAgent: req.get('User-Agent'),
            ip: req.ip || req.connection.remoteAddress
          });
          
          throw error;
        });
      };
    }

    next();
  };
}

export function aiSecurityMonitoring() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Monitor for potential security issues
    const suspiciousPatterns = [
      /<script[^>]*>/i,
      /javascript:\s*[^\s]+/i,
      /on\w+\s*=\s*["'][^"']*["']/i, // More specific - must have quotes
      /union\s+select/i,
      /drop\s+table/i,
      /delete\s+from/i,
      /exec\s*\(/i,
      /eval\s*\(/i
    ];

    // Only check for security threats in specific contexts
    const shouldCheckSecurity = req.method === 'POST' || 
                               req.method === 'PUT' || 
                               req.method === 'PATCH' ||
                               req.path.includes('/api/') ||
                               req.path.includes('/admin/');

    if (shouldCheckSecurity) {
      const requestString = JSON.stringify({
        url: req.url,
        body: req.body,
        query: req.query,
        headers: req.headers
      });

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(requestString)) {
          // Log but don't block - just monitor
          secureLogger.warn('Potential security pattern detected', {
            pattern: pattern.source,
            endpoint: req.path,
            method: req.method,
            userAgent: req.get('User-Agent'),
            ip: req.ip || req.connection.remoteAddress
          });
          
          aiErrorHandler.captureError(
            `Potential security threat detected: ${pattern.source}`,
            {
              endpoint: req.path,
              method: req.method,
              userAgent: req.get('User-Agent'),
              ip: req.ip || req.connection.remoteAddress,
              requestBody: req.body,
              pattern: pattern.source
            }
          );
          break;
        }
      }
    }

    // Monitor for unusual request patterns
    const userAgent = req.get('User-Agent') || '';
    if (userAgent.includes('bot') || userAgent.includes('crawler')) {
      // Log but don't treat as error for bots
      secureLogger.info('Bot request detected', {
        userAgent,
        endpoint: req.path,
        ip: req.ip || req.connection.remoteAddress
      });
    }

    next();
  };
}

// Combined middleware that applies all monitoring
export function aiMonitoring() {
  return [
    aiRequestMonitoring(),
    aiPerformanceMonitoring(),
    aiDatabaseMonitoring(),
    aiSecurityMonitoring()
  ];
}
