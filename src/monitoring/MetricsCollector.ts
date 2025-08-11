import { Request, Response } from 'express';

import { db } from '../database/connection';
import secureLogger from '../shared/logger';

interface BusinessMetrics {
  payments: {
    total: number;
    successful: number;
    failed: number;
    totalAmount: number;
    averageAmount: number;
    byDeviceType: Record<string, number>;
    byHour: Record<string, number>;
  };
  devices: {
    total: number;
    active: number;
    byType: Record<string, number>;
    newRegistrations: number;
  };
  performance: {
    averageResponseTime: number;
    requestsPerMinute: number;
    errorRate: number;
  };
}

interface SystemMetrics {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
  };
  database: {
    connections: number;
    queryTime: number;
  };
}

class MetricsCollector {
  private requestTimes: number[] = [];
  private errorCount = 0;
  private requestCount = 0;
  private startTime = Date.now();

  // Track request performance
  recordRequest(duration: number, isError: boolean = false): void {
    this.requestTimes.push(duration);
    this.requestCount++;
    
    if (isError) {
      this.errorCount++;
    }
    
    // Keep only last 1000 requests for memory efficiency
    if (this.requestTimes.length > 1000) {
      this.requestTimes = this.requestTimes.slice(-1000);
    }
  }

  private async getBusinessMetrics(): Promise<BusinessMetrics> {
    try {
      // Payment metrics
      const paymentStats = await db.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
          COALESCE(SUM(CASE WHEN status = 'completed' THEN amount END), 0) as total_amount,
          COALESCE(AVG(CASE WHEN status = 'completed' THEN amount END), 0) as average_amount
        FROM transactions 
        WHERE created_at >= NOW() - INTERVAL '24 hours'
      `);

      // Payments by device type
      const paymentsByDevice = await db.query(`
        SELECT 
          d.device_type,
          COUNT(t.id) as payment_count
        FROM transactions t
        JOIN devices d ON t.device_id = d.id
        WHERE t.created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY d.device_type
      `);

      // Payments by hour
      const paymentsByHour = await db.query(`
        SELECT 
          EXTRACT(hour FROM created_at) as hour,
          COUNT(*) as payment_count
        FROM transactions 
        WHERE created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY EXTRACT(hour FROM created_at)
        ORDER BY hour
      `);

      // Device metrics
      const deviceStats = await db.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN last_seen >= NOW() - INTERVAL '1 hour' THEN 1 END) as active,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as new_registrations
        FROM devices
      `);

      const devicesByType = await db.query(`
        SELECT 
          device_type,
          COUNT(*) as device_count
        FROM devices
        GROUP BY device_type
      `);

      const stats = paymentStats.rows[0];
      const devices = deviceStats.rows[0];

      return {
        payments: {
          total: parseInt(stats.total),
          successful: parseInt(stats.successful),
          failed: parseInt(stats.failed),
          totalAmount: parseFloat(stats.total_amount),
          averageAmount: parseFloat(stats.average_amount),
          byDeviceType: paymentsByDevice.rows.reduce((acc: Record<string, number>, row: any) => {
            acc[row.device_type] = parseInt(row.payment_count);
            return acc;
          }, {} as Record<string, number>),
          byHour: paymentsByHour.rows.reduce((acc: Record<string, number>, row: any) => {
            acc[row.hour] = parseInt(row.payment_count);
            return acc;
          }, {} as Record<string, number>)
        },
        devices: {
          total: parseInt(devices.total),
          active: parseInt(devices.active),
          byType: devicesByType.rows.reduce((acc: Record<string, number>, row: any) => {
            acc[row.device_type] = parseInt(row.device_count);
            return acc;
          }, {} as Record<string, number>),
          newRegistrations: parseInt(devices.new_registrations)
        },
        performance: {
          averageResponseTime: this.requestTimes.length > 0 
            ? Math.round(this.requestTimes.reduce((a, b) => a + b, 0) / this.requestTimes.length)
            : 0,
          requestsPerMinute: Math.round(this.requestCount / ((Date.now() - this.startTime) / 60000)),
          errorRate: this.requestCount > 0 ? Math.round((this.errorCount / this.requestCount) * 100) : 0
        }
      };
    } catch (error) {
      secureLogger.error('Error collecting business metrics', { error });
      throw error;
    }
  }

  private getSystemMetrics(): SystemMetrics {
    const memUsage = process.memoryUsage();
    
    return {
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        total: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
      },
      cpu: {
        usage: Math.round(process.cpuUsage().user / 1000) // Convert to milliseconds
      },
      database: {
        connections: 1, // You'd get this from your connection pool
        queryTime: 0 // Average query time - you'd track this
      }
    };
  }

  async getMetrics(): Promise<{ business: BusinessMetrics; system: SystemMetrics }> {
    const [business, system] = await Promise.all([
      this.getBusinessMetrics(),
      Promise.resolve(this.getSystemMetrics())
    ]);

    return { business, system };
  }

  async handleMetricsEndpoint(req: Request, res: Response): Promise<void> {
    try {
      const metrics = await this.getMetrics();
      
      res.json({
        timestamp: new Date().toISOString(),
        ...metrics
      });
    } catch (error) {
      secureLogger.error('Error generating metrics', { error });
      res.status(500).json({
        error: 'Failed to generate metrics',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Prometheus-compatible metrics endpoint
  async handlePrometheusMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = await this.getMetrics();
      
      const prometheusMetrics = [
        // Business metrics
        `# TYPE upp_payments_total counter`,
        `upp_payments_total ${metrics.business.payments.total}`,
        `# TYPE upp_payments_successful counter`,
        `upp_payments_successful ${metrics.business.payments.successful}`,
        `# TYPE upp_payments_failed counter`,
        `upp_payments_failed ${metrics.business.payments.failed}`,
        `# TYPE upp_payment_amount_total counter`,
        `upp_payment_amount_total ${metrics.business.payments.totalAmount}`,
        `# TYPE upp_devices_total gauge`,
        `upp_devices_total ${metrics.business.devices.total}`,
        `# TYPE upp_devices_active gauge`,
        `upp_devices_active ${metrics.business.devices.active}`,
        
        // System metrics
        `# TYPE upp_memory_usage_bytes gauge`,
        `upp_memory_usage_bytes ${metrics.system.memory.used * 1024 * 1024}`,
        `# TYPE upp_memory_usage_percentage gauge`,
        `upp_memory_usage_percentage ${metrics.system.memory.percentage}`,
        `# TYPE upp_response_time_ms gauge`,
        `upp_response_time_ms ${metrics.business.performance.averageResponseTime}`,
        `# TYPE upp_requests_per_minute gauge`,
        `upp_requests_per_minute ${metrics.business.performance.requestsPerMinute}`,
        `# TYPE upp_error_rate_percentage gauge`,
        `upp_error_rate_percentage ${metrics.business.performance.errorRate}`,
        
        // Device type breakdown
        ...Object.entries(metrics.business.devices.byType).map(([type, count]) => 
          `upp_devices_by_type{device_type="${type}"} ${count}`
        ),
        
        // Payment device type breakdown
        ...Object.entries(metrics.business.payments.byDeviceType).map(([type, count]) => 
          `upp_payments_by_device_type{device_type="${type}"} ${count}`
        )
      ].join('\n');

      res.set('Content-Type', 'text/plain');
      res.send(prometheusMetrics);
    } catch (error) {
      secureLogger.error('Error generating Prometheus metrics', { error });
      res.status(500).send('# Error generating metrics\n');
    }
  }

  // Dashboard metrics for admin interface
  async getDashboardMetrics(): Promise<any> {
    try {
      const metrics = await this.getMetrics();
      
      return {
        summary: {
          totalPayments: metrics.business.payments.total,
          successfulPayments: metrics.business.payments.successful,
          totalRevenue: metrics.business.payments.totalAmount,
          activeDevices: metrics.business.devices.active,
          successRate: metrics.business.payments.total > 0 
            ? Math.round((metrics.business.payments.successful / metrics.business.payments.total) * 100)
            : 0
        },
        charts: {
          paymentsByHour: metrics.business.payments.byHour,
          deviceTypes: metrics.business.devices.byType,
          paymentsByDeviceType: metrics.business.payments.byDeviceType
        },
        performance: {
          responseTime: metrics.business.performance.averageResponseTime,
          requestsPerMinute: metrics.business.performance.requestsPerMinute,
          errorRate: metrics.business.performance.errorRate,
          memoryUsage: metrics.system.memory.percentage
        },
        alerts: this.generateAlerts(metrics)
      };
    } catch (error) {
      secureLogger.error('Error generating dashboard metrics', { error });
      throw error;
    }
  }

  private generateAlerts(metrics: { business: BusinessMetrics; system: SystemMetrics }): Array<{
    level: 'info' | 'warning' | 'critical';
    message: string;
    timestamp: string;
  }> {
    const alerts = [];
    const timestamp = new Date().toISOString();

    // Memory usage alert
    if (metrics.system.memory.percentage > 90) {
      alerts.push({
        level: 'critical' as const,
        message: `Critical memory usage: ${metrics.system.memory.percentage}%`,
        timestamp
      });
    } else if (metrics.system.memory.percentage > 75) {
      alerts.push({
        level: 'warning' as const,
        message: `High memory usage: ${metrics.system.memory.percentage}%`,
        timestamp
      });
    }

    // Error rate alert
    if (metrics.business.performance.errorRate > 10) {
      alerts.push({
        level: 'critical' as const,
        message: `High error rate: ${metrics.business.performance.errorRate}%`,
        timestamp
      });
    } else if (metrics.business.performance.errorRate > 5) {
      alerts.push({
        level: 'warning' as const,
        message: `Elevated error rate: ${metrics.business.performance.errorRate}%`,
        timestamp
      });
    }

    // Response time alert
    if (metrics.business.performance.averageResponseTime > 2000) {
      alerts.push({
        level: 'warning' as const,
        message: `Slow response time: ${metrics.business.performance.averageResponseTime}ms`,
        timestamp
      });
    }

    // Success rate alert
    const successRate = metrics.business.payments.total > 0 
      ? (metrics.business.payments.successful / metrics.business.payments.total) * 100
      : 100;

    if (successRate < 95 && metrics.business.payments.total > 10) {
      alerts.push({
        level: 'warning' as const,
        message: `Payment success rate below 95%: ${Math.round(successRate)}%`,
        timestamp
      });
    }

    return alerts;
  }
}

export const metricsCollector = new MetricsCollector();