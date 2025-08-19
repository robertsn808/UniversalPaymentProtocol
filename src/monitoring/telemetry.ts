import { NodeSDK } from '@opentelemetry/sdk-node';
// Using string constants to avoid version conflicts
const SERVICE_NAME = 'service.name';
const SERVICE_VERSION = 'service.version';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { env } from '../config/environment.js';
import { secureLogger } from '../shared/logger.js';

export class TelemetryManager {
  private sdk: NodeSDK | null = null;
  private isInitialized = false;

  public initialize(): void {
    if (this.isInitialized) {
      return;
    }

    try {
      // Only initialize telemetry if we have the required environment variables
      if (!env.BETTERSTACK_TOKEN || !env.BETTERSTACK_ENDPOINT) {
        secureLogger.info('OpenTelemetry disabled - missing Better Stack configuration');
        return;
      }

      // Configure trace exporter for Better Stack
      const traceExporter = new OTLPTraceExporter({
        url: `${env.BETTERSTACK_ENDPOINT}/v1/traces`,
        headers: {
          'Authorization': `Bearer ${env.BETTERSTACK_TOKEN}`,
        },
      });

      // Configure metrics exporter for Better Stack
      const metricExporter = new OTLPMetricExporter({
        url: `${env.BETTERSTACK_ENDPOINT}/v1/metrics`,
        headers: {
          'Authorization': `Bearer ${env.BETTERSTACK_TOKEN}`,
        },
      });

      // Initialize SDK with instrumentations
      this.sdk = new NodeSDK({
        traceExporter,
        metricReader: new PeriodicExportingMetricReader({
          exporter: metricExporter,
          exportIntervalMillis: 15000, // Export every 15 seconds
        }),
        instrumentations: [
          // HTTP instrumentation for Express and external calls
          new HttpInstrumentation({
            // Don't trace health check endpoints to reduce noise
            ignoreIncomingRequestHook: (req) => {
              const url = req.url || '';
              return url.includes('/health') || url.includes('/metrics');
            },
            // Add custom attributes for payment-related requests
            requestHook: (span, request) => {
              const url = (request as any).url || '';
              if (url.includes('/api/payments')) {
                span.setAttributes({
                  'upp.request.type': 'payment',
                  'upp.endpoint': url,
                });
              } else if (url.includes('/api/devices')) {
                span.setAttributes({
                  'upp.request.type': 'device',
                  'upp.endpoint': url,
                });
              }
            },
          }),
          
          // Express instrumentation for route-level tracing
          new ExpressInstrumentation({
            // Add route information to spans
            requestHook: (span, info) => {
              if (info.route) {
                span.setAttributes({
                  'http.route': info.route,
                  'upp.handler': info.route,
                });
              }
            },
          }),
          
          // PostgreSQL instrumentation for database monitoring
          new PgInstrumentation({
            // Add database query information
            requestHook: (span, query) => {
              const sql = (query as any).query?.text || (query as any).text || '';
              span.setAttributes({
                'upp.db.type': 'postgresql',
                'db.operation': this.extractSqlOperation(sql),
              });
            },
          }),
          
          // Redis instrumentation for cache monitoring
          new IORedisInstrumentation({
            // Add Redis operation information
            requestHook: (span, { cmdName, cmdArgs }) => {
              span.setAttributes({
                'upp.cache.type': 'redis',
                'upp.cache.operation': cmdName,
                'upp.cache.key': cmdArgs?.[0]?.toString()?.substring(0, 50) || 'unknown',
              });
            },
          }),
        ],
      });

      // Start the SDK
      this.sdk.start();
      this.isInitialized = true;

      secureLogger.info('OpenTelemetry initialized successfully', {
        service: 'universal-payment-protocol',
        environment: env.NODE_ENV,
        endpoint: env.BETTERSTACK_ENDPOINT,
      });

    } catch (error) {
      secureLogger.error('Failed to initialize OpenTelemetry', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  public shutdown(): Promise<void> {
    if (this.sdk && this.isInitialized) {
      secureLogger.info('Shutting down OpenTelemetry SDK');
      return this.sdk.shutdown();
    }
    return Promise.resolve();
  }

  private extractSqlOperation(sql: string): string {
    const normalized = sql.trim().toUpperCase();
    const operation = normalized.split(' ')[0];
    
    // Map common SQL operations
    const operations: Record<string, string> = {
      'SELECT': 'read',
      'INSERT': 'create',
      'UPDATE': 'update',
      'DELETE': 'delete',
      'CREATE': 'schema',
      'ALTER': 'schema',
      'DROP': 'schema',
    };
    
    return operations[operation] || 'unknown';
  }
}

// Singleton instance
export const telemetryManager = new TelemetryManager();

// Auto-initialize if we're not in test environment
if (env.NODE_ENV !== 'test') {
  telemetryManager.initialize();
}