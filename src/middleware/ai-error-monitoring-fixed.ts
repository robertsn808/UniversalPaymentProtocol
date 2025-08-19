import { Request, Response, NextFunction } from 'express';
import { aiErrorHandler } from '../monitoring/ai-error-handler.js';
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
  responseTime?: number;
  statusCode?: number;
  memoryUsage?: any;
  queryTime?: number;
  query?: string;
  pattern?: string;
  responseBody?: any;
}

export function aiErrorMonitoring() {
  return async (error: Error, req: Request, res: Response, next: NextFunction) => {
    try {
      const context: AIErrorContext = {
        endpoint: req.path,
        method: req.method,
        userAgent: req.get('User-Agent') || undefined,
        ip: (req.ip || (req.connection as any)?.remoteAddress) as string,
        requestBody: req.body,
        userId: (req as any).user?.userId,
        sessionId: (req as any).sessionId,
        correlationId: (req as any).correlationId
      };

      await aiErrorHandler.captureError(error, context);

      secureLogger.error('Error captured by AI monitoring', {
        error: error.message,
        stack: error.stack,
        context,
        url: req.url,
        method: req.method
      });
    } catch (monitoringError) {
      secureLogger.error('AI error monitoring failed', { 
        originalError: error.message,
        monitoringError: String(monitoringError)
      });
    }

    next(error);
  };
}

export function aiRequestMonitoring() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const originalSend = res.send.bind(res);

    (res as any).send = function(body: any) {
      const responseTime = Date.now() - startTime;

      if (responseTime > 5000) {
        aiErrorHandler.captureError(
          `Slow response detected: ${responseTime}ms for ${req.method} ${req.path}`,
          {
            endpoint: req.path,
            method: req.method,
            responseTime,
            statusCode: res.statusCode,
            userAgent: req.get('User-Agent') || undefined,
            ip: (req.ip || (req.connection as any)?.remoteAddress) as string
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
            userAgent: req.get('User-Agent') || undefined,
            ip: (req.ip || (req.connection as any)?.remoteAddress) as string
          }
        );
      }

      return originalSend(body);
    } as any;

    next();
  };
}

export function aiPerformanceMonitoring() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = process.hrtime.bigint();

    res.on('finish', () => {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000;

      const mem = process.memoryUsage();
      const memUsageMB = {
        rss: Math.round(mem.rss / 1024 / 1024),
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
        external: Math.round(mem.external / 1024 / 1024)
      };

      if (memUsageMB.heapUsed > 500) {
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

      if (duration > 10000) {
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
    if (!originalQuery) return next();

    (req as any).db.query = function(...args: any[]) {
      const startTime = Date.now();
      return originalQuery.apply(this, args)
        .then((result: any) => {
          const queryTime = Date.now() - startTime;
          if (queryTime > 1000) {
            aiErrorHandler.captureError(
              `Slow database query: ${queryTime}ms`,
              {
                endpoint: req.path,
                method: req.method,
                queryTime,
                query: (args[0]?.substring?.(0, 100) || '') + '...',
                userAgent: req.get('User-Agent') || undefined,
                ip: (req.ip || (req.connection as any)?.remoteAddress) as string
              }
            );
          }
          return result;
        })
        .catch((error: Error) => {
          aiErrorHandler.captureError(error, {
            endpoint: req.path,
            method: req.method,
            query: (args[0]?.substring?.(0, 100) || '') + '...',
            userAgent: req.get('User-Agent') || undefined,
            ip: (req.ip || (req.connection as any)?.remoteAddress) as string
          });
          throw error;
        });
    };

    next();
  };
}

export function aiSecurityMonitoring() {
  return (req: Request, res: Response, next: NextFunction) => {
    const suspiciousPatterns = [
      /<script[^>]*>/i,
      /javascript:\s*[^\s]+/i,
      /on\w+\s*=\s*["'][^"']*["']/i,
      /union\s+select/i,
      /drop\s+table/i,
      /delete\s+from/i,
      /exec\s*\(/i,
      /eval\s*\(/i
    ];

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
          secureLogger.warn('Potential security pattern detected', {
            pattern: pattern.source,
            endpoint: req.path,
            method: req.method,
            userAgent: req.get('User-Agent') || undefined,
            ip: (req.ip || (req.connection as any)?.remoteAddress) as string
          });
          aiErrorHandler.captureError(
            `Potential security threat detected: ${pattern.source}`,
            {
              endpoint: req.path,
              method: req.method,
              userAgent: req.get('User-Agent') || undefined,
              ip: (req.ip || (req.connection as any)?.remoteAddress) as string,
              requestBody: req.body,
              pattern: pattern.source
            }
          );
          break;
        }
      }
    }

    next();
  };
}

// Convenience aggregator for simple enablement
export function aiMonitoring() {
  const perf = aiPerformanceMonitoring();
  const reqMon = aiRequestMonitoring();
  const sec = aiSecurityMonitoring();
  return (req: Request, res: Response, next: NextFunction) => {
    perf(req, res, () => reqMon(req, res, () => sec(req, res, next)));
  };
}
