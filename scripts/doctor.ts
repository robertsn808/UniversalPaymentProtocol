// UPP Doctor: Environment and readiness checks for fast adoption
import fs from 'fs';
import path from 'path';
import Stripe from 'stripe';

import { env, getSanitizedConfig } from '../src/config/environment.js';
import { db } from '../src/database/connection.js';
import secureLogger from '../src/shared/logger.js';

async function checkDatabase() {
  const start = Date.now();
  try {
    const ok = await db.testConnection();
    const ms = Date.now() - start;
    return { ok, ms };
  } catch (err) {
    return { ok: false, ms: Date.now() - start, error: err instanceof Error ? err.message : String(err) };
  }
}

async function checkRedis() {
  const start = Date.now();
  try {
    await db.redis.ping();
    const ms = Date.now() - start;
    return { ok: true, ms };
  } catch (err) {
    return { ok: false, ms: Date.now() - start, error: err instanceof Error ? err.message : String(err) };
  }
}

function checkStripeKeys() {
  const secret = process.env.STRIPE_SECRET_KEY;
  const publishable = process.env.STRIPE_PUBLISHABLE_KEY;

  if (!secret || secret === 'STRIPE_DISABLED') {
    return { ok: false, mode: 'disabled', message: 'STRIPE_SECRET_KEY not set' };
  }

  // Basic format check only (no network call)
  const prod = env.NODE_ENV === 'production';
  const validPrefix = prod ? secret.startsWith('sk_live_') : secret.startsWith('sk_test_');
  return { ok: validPrefix, mode: prod ? 'live' : 'test', publishable: !!publishable };
}

function checkWebhookRegistration() {
  try {
    const idx = path.resolve('UPP/server/index.ts');
    const content = fs.readFileSync(idx, 'utf8');
    const wired = content.includes('/webhooks/stripe') || content.includes('registerStripeWebhook');
    return { wired };
  } catch {
    return { wired: false };
  }
}

async function main() {
  console.log('\n=== UPP Doctor: Readiness Check ===');
  console.log(`Environment: ${env.NODE_ENV}`);
  console.log('Config:', getSanitizedConfig());

  const results: Record<string, any> = {};

  results.database = await checkDatabase();
  console.log(`- Database: ${results.database.ok ? 'OK' : 'FAIL'} (${results.database.ms}ms)`);

  results.redis = await checkRedis();
  console.log(`- Redis: ${results.redis.ok ? 'OK' : 'DEGRADED'} (${results.redis.ms}ms)`);

  results.stripe = checkStripeKeys();
  console.log(`- Stripe: ${results.stripe.ok ? `OK (${results.stripe.mode})` : 'DISABLED'}`);

  const webhook = checkWebhookRegistration();
  console.log(`- Stripe Webhook route: ${webhook.wired ? 'Registered' : 'Not detected'}`);

  // Optional: Verify STRIPE_WEBHOOK_SECRET presence
  const wh = process.env.STRIPE_WEBHOOK_SECRET;
  console.log(`- Webhook secret: ${wh ? 'Set' : 'Missing'}`);

  // Quick guidance
  console.log('\nNext Steps:');
  if (!results.stripe.ok) {
    console.log('  • Set STRIPE_SECRET_KEY (sk_test_… for dev) and STRIPE_PUBLISHABLE_KEY');
  }
  if (!webhook.wired) {
    console.log('  • Register webhook route early in server startup:');
    console.log("    import { registerStripeWebhook } from '../src/webhooks/registerStripeWebhook.js';");
    console.log('    registerStripeWebhook(app); // before express.json()');
  }
  if (!wh) {
    console.log('  • Set STRIPE_WEBHOOK_SECRET and configure Stripe to POST to /webhooks/stripe');
  }

  const failures = [!results.database.ok, env.NODE_ENV === 'production' && !results.stripe.ok].filter(Boolean).length;
  if (failures > 0) {
    console.log('\nResult: ❌ Issues detected. Resolve the items above.');
    process.exitCode = 1;
  } else {
    console.log('\nResult: ✅ Ready for local development.');
  }

  // Log sanitized summary
  secureLogger.info('UPP Doctor run', {
    database_ok: results.database.ok,
    redis_ok: results.redis.ok,
    stripe_ok: results.stripe.ok,
    webhook_registered: webhook.wired
  });
}

main().catch((err) => {
  console.error('UPP Doctor error:', err);
  process.exitCode = 1;
});

