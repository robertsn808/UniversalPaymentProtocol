
// Secure Environment Configuration with Validation
import { z } from 'zod';

// Environment schema with strict validation
const EnvironmentSchema = z.object({
  // Server Configuration
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  PORT: z.coerce.number().min(1).max(65535).default(9000),
  
  // Database Configuration
  DATABASE_URL: z.string().optional().default('postgresql://postgres:password@localhost:5432/upp'),
  DB_PASSWORD: z.string().optional(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  
  // Stripe Configuration
  STRIPE_SECRET_KEY: z.string().min(1).refine(
    (val) => {
      if (process.env.NODE_ENV === 'production') {
        return val.startsWith('sk_live_') && val.length > 20;
      }
      return val.startsWith('sk_test_') || val === 'STRIPE_DISABLED';
    },
    { message: 'Invalid Stripe secret key format for environment' }
  ).optional().default('STRIPE_DISABLED'),
  STRIPE_PUBLISHABLE_KEY: z.string().min(1).refine(
    (val) => {
      if (process.env.NODE_ENV === 'production') {
        return val.startsWith('pk_live_') && val.length > 20;
      }
      return val.startsWith('pk_test_') || val === 'STRIPE_DISABLED';
    },
    { message: 'Invalid Stripe publishable key format for environment' }
  ).optional().default('STRIPE_DISABLED'),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  
  // Security Configuration - CRITICAL: Must be set in production
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters').refine(
    (val) => {
      if (process.env.NODE_ENV === 'production') {
        return val !== 'upp-production-jwt-secret-2024-secure-random-key-32chars' && 
               val !== 'dev-jwt-secret-not-secure-change-me-please-32chars';
      }
      return true;
    },
    { message: 'JWT_SECRET must be set to a secure random string in production' }
  ).default(() => {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable must be set in production');
    }
    return 'dev-jwt-secret-not-secure-change-me-please-32chars';
  }),
  JWT_EXPIRES_IN: z.string().default('24h'),
  
  // API Configuration - Higher default for production
  API_RATE_LIMIT_REQUESTS: z.coerce.number().min(1).default(
    process.env.NODE_ENV === 'production' ? 1000 : 300
  ),
  API_RATE_LIMIT_WINDOW_MS: z.coerce.number().min(1000).default(900000), // 15 minutes
  
  // Logging Configuration
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('info'),
  LOG_TO_FILE: z.coerce.boolean().default(true),
  
  // Frontend Configuration
  FRONTEND_URL: z.string().url().default('http://localhost:9000'),
  CORS_ORIGINS: z.string().default('http://localhost:9000,http://localhost:3000'),
  
  // Encryption
  ENCRYPTION_KEY: z.string().min(32, 'Encryption key must be at least 32 characters').optional(),
  
  // Visa Direct Configuration (Optional)
  VISA_API_BASE_URL: z.string().url().optional().default('https://sandbox.api.visa.com'),
  VISA_USER_ID: z.string().optional(),
  VISA_PASSWORD: z.string().optional(),
  VISA_CERT_PATH: z.string().optional(),
  VISA_KEY_PATH: z.string().optional(),
  
  // PCI Compliance Configuration
  PCI_ENCRYPTION_KEY: z.string().min(32, 'PCI encryption key must be at least 32 characters').optional(),
  PCI_TOKENIZATION_KEY: z.string().min(32, 'PCI tokenization key must be at least 32 characters').optional(),
  PCI_IP_ALLOWLIST: z.string().optional(),
  FORCE_HTTPS: z.coerce.boolean().default(false),
  
  // OpenTelemetry/Better Stack Configuration
  BETTERSTACK_TOKEN: z.string().optional(),
  BETTERSTACK_ENDPOINT: z.string().url().optional().default('https://s1476875.eu-nbg-2.betterstackdata.com'),
});

// Validate and export environment configuration
export const env = EnvironmentSchema.parse(process.env);

// Type for environment configuration
export type Environment = z.infer<typeof EnvironmentSchema>;

// Security validation functions
export const isProduction = () => env.NODE_ENV === 'production';
export const isDevelopment = () => env.NODE_ENV === 'development';
export const isStaging = () => env.NODE_ENV === 'staging';
export const isTest = () => env.NODE_ENV === 'test';

// Validate required security settings for production
export const validateProductionSecurity = () => {
  if (!isProduction()) return;
  
  // Warn about missing environment variables but don't fail
  const recommendedInProduction = [
    'JWT_SECRET',
    'DATABASE_URL'
  ];
  
  const missing = recommendedInProduction.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.warn(`⚠️  Recommended production environment variables not set: ${missing.join(', ')}`);
    console.warn('🔄 Using default values for deployment. Set these for production use.');
  }
  
  // Validate JWT secret strength in production
  if (env.JWT_SECRET.includes('dev-') || env.JWT_SECRET.includes('default')) {
    console.warn('⚠️  Using default JWT_SECRET in production. Set a secure JWT_SECRET for production use.');
  }
  
  // Validate Stripe configuration
  if (env.STRIPE_SECRET_KEY === 'STRIPE_DISABLED') {
    if (env.NODE_ENV === 'production') {
      console.error('❌ STRIPE_SECRET_KEY must be set in production');
    } else {
      console.warn('⚠️  Stripe is disabled - payments will not work. Set STRIPE_SECRET_KEY for testing.');
    }
  } else if (env.NODE_ENV === 'production' && !env.STRIPE_SECRET_KEY.startsWith('sk_live_')) {
    console.error('❌ Production environment requires live Stripe keys (sk_live_...)');
  }
};

// Export sanitized config for logging (removes sensitive data)
export const getSanitizedConfig = () => ({
  NODE_ENV: env.NODE_ENV,
  PORT: env.PORT,
  DATABASE_URL: env.DATABASE_URL.replace(/\/\/.*@/, '//***:***@'), // Hide credentials
  REDIS_URL: env.REDIS_URL.replace(/\/\/.*@/, '//***:***@'),
  STRIPE_PUBLISHABLE_KEY: env.STRIPE_PUBLISHABLE_KEY ? env.STRIPE_PUBLISHABLE_KEY.substring(0, 10) + '...' : 'demo_mode',
  FRONTEND_URL: env.FRONTEND_URL,
  CORS_ORIGINS: env.CORS_ORIGINS,
  LOG_LEVEL: env.LOG_LEVEL,
  LOG_TO_FILE: env.LOG_TO_FILE,
  API_RATE_LIMIT_REQUESTS: env.API_RATE_LIMIT_REQUESTS,
  API_RATE_LIMIT_WINDOW_MS: env.API_RATE_LIMIT_WINDOW_MS,
});
