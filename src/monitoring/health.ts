import { Request, Response } from 'express';
import { db } from '../database/connection.js';
import { secureLogger } from '../shared/logger.js';
import { env } from '../config/environment.js';
import { telemetryManager } from './telemetry.js';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  environment: string;
  timestamp: string;
  uptime: number;
  services: {
    database: {
      status: 'up' | 'down';
      responseTime?: number;
    };
    redis: {
      status: 'up' | 'down';
      responseTime?: number;
    };
    telemetry: {
      status: 'enabled' | 'disabled';
      endpoint?: string;
    };
  };
  metrics?: {
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
}

export async function healthCheck(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  let overallStatus: HealthStatus['status'] = 'healthy';
  
  try {
    // Test database connection
    const dbStartTime = Date.now();
    const dbHealth = await db.healthCheck();
    const dbResponseTime = Date.now() - dbStartTime;
    
    // Test Redis connection
    const redisStartTime = Date.now();
    let redisStatus: 'up' | 'down' = 'down';
    let redisResponseTime: number | undefined;
    
    try {
      await db.redis.ping();
      redisStatus = 'up';
      redisResponseTime = Date.now() - redisStartTime;
    } catch (error) {
      secureLogger.warn('Redis health check failed', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      overallStatus = 'degraded'; // Redis is not critical, so just degraded
    }
    
    // Check database status
    if (!dbHealth.postgres) {
      overallStatus = 'unhealthy';
    }
    
    // Check telemetry status
    const telemetryEnabled = !!(env.BETTERSTACK_TOKEN && env.BETTERSTACK_ENDPOINT);
    
    const healthStatus: HealthStatus = {
      status: overallStatus,
      version: process.env.npm_package_version || '1.0.5',
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: {
          status: dbHealth.postgres ? 'up' : 'down',
          responseTime: dbResponseTime,
        },
        redis: {
          status: redisStatus,
          responseTime: redisResponseTime,
        },
        telemetry: {
          status: telemetryEnabled ? 'enabled' : 'disabled',
          endpoint: telemetryEnabled ? env.BETTERSTACK_ENDPOINT : undefined,
        },
      },
    };
    
    // Add detailed metrics for internal health checks
    if (req.query.detailed === 'true') {
      healthStatus.metrics = {
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
      };
    }
    
    const responseTime = Date.now() - startTime;
    
    // Set appropriate HTTP status code
    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(healthStatus);
    
    // Don't log health checks unless they fail
    if (overallStatus !== 'healthy') {
      secureLogger.warn('Health check returned non-healthy status', {
        status: overallStatus,
        services: healthStatus.services,
        responseTime: responseTime,
      });
    }
    
  } catch (error) {
    secureLogger.error('Health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      responseTime: Date.now() - startTime,
    });
    
    res.status(503).json({
      status: 'unhealthy',
      version: process.env.npm_package_version || '1.0.5',
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
}

/**
 * Simple liveness probe for Kubernetes/Docker
 */
export function livenessCheck(req: Request, res: Response): void {
  res.status(200).send('OK');
}

/**
 * Readiness probe that checks critical dependencies
 */
export async function readinessCheck(req: Request, res: Response): Promise<void> {
  try {
    // Check database connection
    const dbHealth = await db.healthCheck();
    
    if (dbHealth.postgres) {
      res.status(200).send('READY');
    } else {
      res.status(503).send('NOT_READY');
    }
  } catch (error) {
    secureLogger.error('Readiness check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(503).send('NOT_READY');
  }
}

/**
 * Metrics endpoint for Prometheus/monitoring
 */
export function metricsEndpoint(req: Request, res: Response): void {
  const metrics = {
    upp_uptime_seconds: process.uptime(),
    upp_memory_usage_bytes: process.memoryUsage().rss,
    upp_heap_used_bytes: process.memoryUsage().heapUsed,
    upp_heap_total_bytes: process.memoryUsage().heapTotal,
    upp_external_bytes: process.memoryUsage().external,
    upp_version_info: {
      version: process.env.npm_package_version || '1.0.5',
      environment: env.NODE_ENV,
      node_version: process.version,
    },
  };
  
  res.json(metrics);
}