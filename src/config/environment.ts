
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default(5000),
  
  // Database
  DATABASE_URL: z.string().optional(),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.string().transform(Number).default(5432),
  DB_NAME: z.string().default('upp_db'),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string().default('password'),
  
  // Visa Direct Configuration
  VISA_USER_ID: z.string().default('demo_mode'),
  VISA_PASSWORD: z.string().default('demo_mode'),
  VISA_CERT_PATH: z.string().default('/tmp/visa_cert.pem'),
  VISA_KEY_PATH: z.string().default('/tmp/visa_key.pem'),
  VISA_API_BASE_URL: z.string().default('https://sandbox.api.visa.com'),
  
  // Security
  JWT_SECRET: z.string().default('your-super-secret-jwt-key-change-in-production'),
  ENCRYPTION_KEY: z.string().default('your-32-character-encryption-key!!'),
  PCI_ENCRYPTION_KEY: z.string().default('your-32-character-pci-encryption-key'),
  FORCE_HTTPS: z.string().transform(Boolean).default(false),
  
  // External APIs
  EXCHANGE_RATE_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  
  // GitHub Integration
  GITHUB_TOKEN: z.string().optional(),
  GITHUB_OWNER: z.string().optional(),
  GITHUB_REPO: z.string().optional(),
  
  // Stripe (for fallback/comparison)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default(100),
  API_RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default(900000),
  API_RATE_LIMIT_REQUESTS: z.string().transform(Number).default(100),
  
  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  
  // Features
  ENABLE_MULTI_CURRENCY: z.string().transform(Boolean).default(true),
  ENABLE_AUDIT_TRAIL: z.string().transform(Boolean).default(true),
  ENABLE_AI_MONITORING: z.string().transform(Boolean).default(false),
  PCI_COMPLIANCE_MODE: z.string().transform(Boolean).default(true),
  ENABLE_TOKENIZATION: z.string().transform(Boolean).default(true),
  ENABLE_FRAUD_DETECTION: z.string().transform(Boolean).default(true),
});

function loadEnvironment() {
  try {
    const env = EnvSchema.parse(process.env);
    
    console.log('🌊 Environment Configuration Loaded');
    console.log(`   Environment: ${env.NODE_ENV}`);
    console.log(`   Port: ${env.PORT}`);
    console.log(`   Payment Processor: Visa Direct ${env.VISA_USER_ID !== 'demo_mode' ? '(Live)' : '(Demo)'}`);
    console.log(`   Multi-currency: ${env.ENABLE_MULTI_CURRENCY ? 'Enabled' : 'Disabled'}`);
    console.log(`   Audit Trail: ${env.ENABLE_AUDIT_TRAIL ? 'Enabled' : 'Disabled'}`);
    
    return env;
  } catch (error) {
    console.error('❌ Environment validation failed:');
    if (error instanceof z.ZodError) {
      error.errors.forEach(err => {
        console.error(`   ${err.path.join('.')}: ${err.message}`);
      });
    }
    throw new Error('Invalid environment configuration');
  }
}

export const env = loadEnvironment();

// Visa configuration validation
export function validateVisaConfiguration(): boolean {
  if (env.VISA_USER_ID === 'demo_mode' || env.VISA_PASSWORD === 'demo_mode') {
    console.log('⚠️  Running in demo mode - Visa Direct not configured');
    console.log('   Set VISA_USER_ID and VISA_PASSWORD environment variables for live payments');
    return false;
  }
  
  console.log('✅ Visa Direct configuration detected');
  return true;
}

// Database connection string
export function getDatabaseUrl(): string {
  if (env.DATABASE_URL) {
    return env.DATABASE_URL;
  }
  
  return `postgresql://${env.DB_USER}:${env.DB_PASSWORD}@${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`;
}

export default env;
