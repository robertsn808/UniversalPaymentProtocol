import { metrics, trace, SpanStatusCode } from '@opentelemetry/api';
import { secureLogger } from '../shared/logger.js';

// Create a meter for UPP-specific metrics
const meter = metrics.getMeter('upp-metrics', '1.0.0');
const tracer = trace.getTracer('upp-tracer', '1.0.0');

// Payment Processing Metrics
export const paymentMetrics = {
  // Counter for total payment requests
  paymentRequests: meter.createCounter('upp_payment_requests_total', {
    description: 'Total number of payment requests processed',
    unit: '1',
  }),

  // Counter for payment success/failure
  paymentResults: meter.createCounter('upp_payment_results_total', {
    description: 'Payment processing results by status',
    unit: '1',
  }),

  // Histogram for payment processing duration
  paymentDuration: meter.createHistogram('upp_payment_duration_ms', {
    description: 'Time taken to process payments',
    unit: 'ms',
  }),

  // Counter for payment amounts (for monitoring transaction volumes)
  paymentAmount: meter.createCounter('upp_payment_amount_total', {
    description: 'Total payment amounts processed',
    unit: 'cents',
  }),

  // Gauge for active payment sessions
  activeSessions: meter.createUpDownCounter('upp_active_payment_sessions', {
    description: 'Number of active payment sessions',
    unit: '1',
  }),
};

// Device Adapter Metrics
export const deviceMetrics = {
  // Counter for device registrations
  deviceRegistrations: meter.createCounter('upp_device_registrations_total', {
    description: 'Total number of device registrations',
    unit: '1',
  }),

  // Counter for device requests by type
  deviceRequests: meter.createCounter('upp_device_requests_total', {
    description: 'Device requests by type',
    unit: '1',
  }),

  // Histogram for device response times
  deviceResponseTime: meter.createHistogram('upp_device_response_time_ms', {
    description: 'Device adapter response times',
    unit: 'ms',
  }),

  // Gauge for connected devices
  connectedDevices: meter.createUpDownCounter('upp_connected_devices', {
    description: 'Number of currently connected devices',
    unit: '1',
  }),
};

// Database and Cache Metrics
export const dataMetrics = {
  // Counter for database queries
  databaseQueries: meter.createCounter('upp_database_queries_total', {
    description: 'Total database queries executed',
    unit: '1',
  }),

  // Histogram for database query duration
  databaseDuration: meter.createHistogram('upp_database_duration_ms', {
    description: 'Database query execution time',
    unit: 'ms',
  }),

  // Counter for cache operations
  cacheOperations: meter.createCounter('upp_cache_operations_total', {
    description: 'Cache operations (hit/miss/set)',
    unit: '1',
  }),

  // Gauge for database connection pool
  connectionPool: meter.createUpDownCounter('upp_db_connections_active', {
    description: 'Active database connections',
    unit: '1',
  }),
};

// Security Metrics
export const securityMetrics = {
  // Counter for authentication attempts
  authAttempts: meter.createCounter('upp_auth_attempts_total', {
    description: 'Authentication attempts by result',
    unit: '1',
  }),

  // Counter for rate limiting
  rateLimitHits: meter.createCounter('upp_rate_limit_hits_total', {
    description: 'Rate limit violations',
    unit: '1',
  }),

  // Counter for security events
  securityEvents: meter.createCounter('upp_security_events_total', {
    description: 'Security-related events',
    unit: '1',
  }),

  // Histogram for JWT token validation time
  tokenValidation: meter.createHistogram('upp_token_validation_ms', {
    description: 'JWT token validation duration',
    unit: 'ms',
  }),
};

// Utility functions for common tracing patterns
export class UPPTracing {
  /**
   * Create a span for payment processing
   */
  static createPaymentSpan(name: string, attributes: Record<string, string | number | boolean> = {}) {
    return tracer.startSpan(`payment.${name}`, {
      attributes: {
        'upp.operation.type': 'payment',
        ...attributes,
      },
    });
  }

  /**
   * Create a span for device operations
   */
  static createDeviceSpan(name: string, deviceType: string, attributes: Record<string, string | number | boolean> = {}) {
    return tracer.startSpan(`device.${name}`, {
      attributes: {
        'upp.operation.type': 'device',
        'upp.device.type': deviceType,
        ...attributes,
      },
    });
  }

  /**
   * Create a span for database operations
   */
  static createDatabaseSpan(name: string, operation: string, attributes: Record<string, string | number | boolean> = {}) {
    return tracer.startSpan(`database.${name}`, {
      attributes: {
        'upp.operation.type': 'database',
        'db.operation': operation,
        ...attributes,
      },
    });
  }

  /**
   * Wrap a function with automatic tracing
   */
  static async trace<T>(
    spanName: string,
    fn: () => Promise<T>,
    attributes: Record<string, string | number | boolean> = {}
  ): Promise<T> {
    const span = tracer.startSpan(spanName, { attributes });
    
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      span.setAttributes({
        'error.type': error instanceof Error ? error.constructor.name : 'UnknownError',
        'error.message': error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    } finally {
      span.end();
    }
  }
}

// Helper function to safely record metrics with error handling
export function recordMetric(
  metricFn: () => void,
  metricName: string
): void {
  try {
    metricFn();
  } catch (error) {
    secureLogger.warn('Failed to record metric', {
      metric: metricName,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Export common metric recording functions
export const MetricRecorders = {
  /**
   * Record a payment request with common attributes
   */
  recordPaymentRequest: (deviceType: string, amount: number, currency: string, success: boolean) => {
    recordMetric(() => {
      paymentMetrics.paymentRequests.add(1, {
        device_type: deviceType,
        currency: currency,
      });
      
      paymentMetrics.paymentResults.add(1, {
        device_type: deviceType,
        status: success ? 'success' : 'failure',
        currency: currency,
      });
      
      if (success) {
        paymentMetrics.paymentAmount.add(amount, {
          device_type: deviceType,
          currency: currency,
        });
      }
    }, 'payment_request');
  },

  /**
   * Record device operation
   */
  recordDeviceOperation: (deviceType: string, operation: string, duration: number, success: boolean) => {
    recordMetric(() => {
      deviceMetrics.deviceRequests.add(1, {
        device_type: deviceType,
        operation: operation,
        status: success ? 'success' : 'failure',
      });
      
      deviceMetrics.deviceResponseTime.record(duration, {
        device_type: deviceType,
        operation: operation,
      });
    }, 'device_operation');
  },

  /**
   * Record database operation
   */
  recordDatabaseOperation: (operation: string, table: string, duration: number, success: boolean) => {
    recordMetric(() => {
      dataMetrics.databaseQueries.add(1, {
        operation: operation,
        table: table,
        status: success ? 'success' : 'failure',
      });
      
      dataMetrics.databaseDuration.record(duration, {
        operation: operation,
        table: table,
      });
    }, 'database_operation');
  },

  /**
   * Record authentication event
   */
  recordAuthEvent: (type: string, success: boolean, method?: string) => {
    recordMetric(() => {
      securityMetrics.authAttempts.add(1, {
        type: type,
        status: success ? 'success' : 'failure',
        method: method || 'unknown',
      });
    }, 'auth_event');
  },

  /**
   * Record rate limit hit
   */
  recordRateLimitHit: (endpoint: string, ipAddress: string) => {
    recordMetric(() => {
      securityMetrics.rateLimitHits.add(1, {
        endpoint: endpoint,
        // Hash IP for privacy
        ip_hash: require('crypto').createHash('sha256').update(ipAddress).digest('hex').substring(0, 8),
      });
    }, 'rate_limit');
  },
};