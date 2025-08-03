// Environment Configuration with Type Safety
// Validates and types all environment variables

import { z } from 'zod';

/**
 * Environment variable validation schema
 * Ensures all required environment variables are present and valid
 */
const EnvironmentSchema = z.object({
  // Node Environment
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  
  // Server Configuration
  PORT: z.coerce.number().min(1).max(65535).default(3000),
  FRONTEND_URL: z.string().url().optional(),
  CORS_ORIGIN: z.string().optional(),
  
  // Security Configuration (Required)
  ENCRYPTION_KEY: z.string().min(32, 'Encryption key must be at least 32 characters'),
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  UPP_API_KEY: z.string().min(10, 'API key must be at least 10 characters'),
  
  // Stripe Configuration
  STRIPE_SECRET_KEY: z.string().startsWith('sk_').optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_').optional(),
  
  // Database Configuration
  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
  
  // Logging Configuration
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FORMAT: z.enum(['json', 'simple']).default('json'),
  
  // Rate Limiting Configuration
  RATE_LIMIT_WINDOW_MS: z.coerce.number().positive().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().positive().default(100),
  
  // External API Configuration
  EXCHANGE_RATE_API_KEY: z.string().optional(),
  CURRENCY_PROVIDER: z.enum(['fixer.io', 'exchangerate-api', 'currencylayer']).default('fixer.io'),
  
  // Monitoring Configuration
  PROMETHEUS_PORT: z.coerce.number().positive().optional(),
  GRAFANA_PORT: z.coerce.number().positive().optional(),
  
  // AWS Configuration
  AWS_REGION: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  AWS_CLOUDFRONT_DOMAIN: z.string().optional(),
  
  // Notification Services
  SENDGRID_API_KEY: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  SLACK_WEBHOOK_URL: z.string().url().optional(),
  
  // Analytics
  GOOGLE_ANALYTICS_ID: z.string().optional(),
  MIXPANEL_TOKEN: z.string().optional()
});

/**
 * Parsed and validated environment variables
 * All environment variables are type-safe and validated
 */
export const env = EnvironmentSchema.parse(process.env);

/**
 * Type definition for environment variables
 */
export type Environment = z.infer<typeof EnvironmentSchema>;

/**
 * Validate that all required environment variables are present
 * Throws an error if any required variables are missing
 */
export function validateEnvironment(): void {
  try {
    EnvironmentSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      console.error('❌ Environment validation failed:');
      missingVars.forEach(err => console.error(`  - ${err}`));
      throw new Error('Environment validation failed. Please check your .env file.');
    }
    throw error;
  }
}

/**
 * Check if running in production environment
 */
export const isProduction = (): boolean => env.NODE_ENV === 'production';

/**
 * Check if running in development environment
 */
export const isDevelopment = (): boolean => env.NODE_ENV === 'development';

/**
 * Check if running in test environment
 */
export const isTest = (): boolean => env.NODE_ENV === 'test';

/**
 * Get server URL based on environment
 */
export const getServerUrl = (): string => {
  if (env.FRONTEND_URL) {
    return env.FRONTEND_URL;
  }
  
  const protocol = isProduction() ? 'https' : 'http';
  const host = isProduction() ? 'localhost' : 'localhost'; // In production, this would be your domain
  
  return `${protocol}://${host}:${env.PORT}`;
};

/**
 * Get database connection configuration
 */
export const getDatabaseConfig = () => {
  if (!env.DATABASE_URL) {
    return null;
  }
  
  try {
    const url = new URL(env.DATABASE_URL);
    return {
      host: url.hostname,
      port: parseInt(url.port) || 5432,
      database: url.pathname.slice(1),
      username: url.username,
      password: url.password,
      ssl: isProduction()
    };
  } catch {
    throw new Error('Invalid DATABASE_URL format');
  }
};

/**
 * Get Redis connection configuration
 */
export const getRedisConfig = () => {
  if (!env.REDIS_URL) {
    return null;
  }
  
  try {
    const url = new URL(env.REDIS_URL);
    return {
      host: url.hostname,
      port: parseInt(url.port) || 6379,
      password: url.password || undefined,
      db: 0
    };
  } catch {
    throw new Error('Invalid REDIS_URL format');
  }
};

/**
 * Export individual environment variables with proper typing
 * This provides a clean interface for accessing environment variables
 */
export const {
  NODE_ENV,
  PORT,
  FRONTEND_URL,
  CORS_ORIGIN,
  ENCRYPTION_KEY,
  JWT_SECRET,
  UPP_API_KEY,
  STRIPE_SECRET_KEY,
  STRIPE_PUBLISHABLE_KEY,
  LOG_LEVEL,
  LOG_FORMAT
} = env;