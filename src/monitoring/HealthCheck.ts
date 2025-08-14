import { Request, Response } from 'express';
import fs from 'fs';

import { env } from '../config/environment';
import { db } from '../database/connection.js';
import secureLogger from '../shared/logger';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    database: ServiceHealth;
    stripe: ServiceHealth;
    memory: ServiceHealth;
    disk: ServiceHealth;
  };
  metrics: {
    totalRequests: number;
    totalPayments: number;
    totalDevices: number;
    averageResponseTime: number;
  };
}

interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  message?: string;
  lastChecked: string;
}

class HealthCheckService {
  private requestCount = 0;
  private paymentCount = 0;
  private responseTimeSum = 0;
  private responseTimeCount = 0;

  // Track metrics
  incrementRequests(): void {
    this.requestCount++;
  }

  incrementPayments(): void {
    this.paymentCount++;
  }

  recordResponseTime(time: number): void {
    this.responseTimeSum += time;
    this.responseTimeCount++;
  }

  private async checkDatabase(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      const result = await db.query('SELECT NOW() as current_time, version() as version');
      const responseTime = Date.now() - startTime;
      
      if (responseTime > 1000) {
        return {
          status: 'degraded',
          responseTime,
          message: 'Database response time is slow',
          lastChecked: new Date().toISOString()
        };
      }
      
      return {
        status: 'healthy',
        responseTime,
        message: `Connected to ${result.rows[0].version.split(' ')[0]}`,
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: error instanceof Error ? error.message : 'Database connection failed',
        lastChecked: new Date().toISOString()
      };
    }
  }

  private async checkStripe(): Promise<ServiceHealth> {
    const startTime = Date.now();
    
    try {
      // Simple check - just verify we have the Stripe key configured
      const hasStripeKey = !!env.STRIPE_SECRET_KEY && env.STRIPE_SECRET_KEY !== 'sk_test_demo_key_for_development_only';
      const responseTime = Date.now() - startTime;
      
      if (!hasStripeKey) {
        return {
          status: 'degraded',
          responseTime,
          message: 'Using demo Stripe configuration',
          lastChecked: new Date().toISOString()
        };
      }
      
      return {
        status: 'healthy',
        responseTime,
        message: 'Stripe configuration validated',
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        message: error instanceof Error ? error.message : 'Stripe check failed',
        lastChecked: new Date().toISOString()
      };
    }
  }

  private checkMemory(): ServiceHealth {
    const memUsage = process.memoryUsage();
    const totalMem = memUsage.heapTotal;
    const usedMem = memUsage.heapUsed;
    const memoryUsagePercent = (usedMem / totalMem) * 100;
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let message = `Memory usage: ${Math.round(memoryUsagePercent)}%`;
    
    if (memoryUsagePercent > 90) {
      status = 'unhealthy';
      message += ' - Critical memory usage';
    } else if (memoryUsagePercent > 75) {
      status = 'degraded';
      message += ' - High memory usage';
    }
    
    return {
      status,
      responseTime: 0,
      message,
      lastChecked: new Date().toISOString()
    };
  }

  private checkDisk(): ServiceHealth {
    try {
      const stats = fs.statSync('./');
      
      // Simple disk check - in production you'd want more sophisticated monitoring
      return {
        status: 'healthy',
        responseTime: 0,
        message: 'Disk access operational',
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: 0,
        message: 'Disk access failed',
        lastChecked: new Date().toISOString()
      };
    }
  }

  private async getMetrics(): Promise<HealthStatus['metrics']> {
    try {
      // Get total devices count
      const deviceCount = await db.query('SELECT COUNT(*) as count FROM devices');
      const totalDevices = parseInt(deviceCount.rows[0].count);
      
      // Get total payments count
      const paymentCount = await db.query('SELECT COUNT(*) as count FROM transactions WHERE status = $1', ['completed']);
      const totalPayments = parseInt(paymentCount.rows[0].count);
      
      const averageResponseTime = this.responseTimeCount > 0 
        ? Math.round(this.responseTimeSum / this.responseTimeCount)
        : 0;
      
      return {
        totalRequests: this.requestCount,
        totalPayments,
        totalDevices,
        averageResponseTime
      };
    } catch (error) {
      secureLogger.error('Error getting health metrics', { error });
      return {
        totalRequests: this.requestCount,
        totalPayments: 0,
        totalDevices: 0,
        averageResponseTime: 0
      };
    }
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const [database, stripe, metrics] = await Promise.all([
      this.checkDatabase(),
      this.checkStripe(),
      this.getMetrics()
    ]);
    
    const memory = this.checkMemory();
    const disk = this.checkDisk();
    
    // Determine overall status
    const services = { database, stripe, memory, disk };
    const serviceStatuses = Object.values(services).map(s => s.status);
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (serviceStatuses.includes('unhealthy')) {
      overallStatus = 'unhealthy';
    } else if (serviceStatuses.includes('degraded')) {
      overallStatus = 'degraded';
    }
    
    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      version: '1.0.0',
      environment: env.NODE_ENV,
      services,
      metrics
    };
  }

  async handleHealthCheck(req: Request, res: Response): Promise<void> {
    try {
      const health = await this.getHealthStatus();
      
      // Set appropriate HTTP status code
      let statusCode = 200;
      if (health.status === 'unhealthy') {
        statusCode = 503; // Service Unavailable
      } else if (health.status === 'degraded') {
        statusCode = 200; // OK but with warnings
      }
      
      res.status(statusCode).json(health);
      
      // Log unhealthy status
      if (health.status === 'unhealthy') {
        secureLogger.error('Health check failed', { health });
      } else if (health.status === 'degraded') {
        secureLogger.warn('Health check degraded', { health });
      }
    } catch (error) {
      secureLogger.error('Health check error', { error });
      res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        message: 'Health check failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Simple health endpoint for load balancers
  async handleSimpleHealth(req: Request, res: Response): Promise<void> {
    try {
      const dbHealth = await this.checkDatabase();
      
      if (dbHealth.status === 'unhealthy') {
        res.status(503).send('UNHEALTHY');
      } else {
        res.status(200).send('OK');
      }
    } catch (error) {
      res.status(503).send('UNHEALTHY');
    }
  }
}

export const healthCheckService = new HealthCheckService();